import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import InputText from "@/components/core/inputText";
import InputTextArea from "@/components/core/inputTextArea";
import InputFilterForm from "@/components/core/inputFilterForm";
import InputDropdown from "@/components/core/inputDropdown";
import {
  FetchAPIParams,
  DynamicFieldRendererProps,
  FilterRow,
  FormSubmissionData,
  FormValue,
} from "@/types/form";
import { useFormStore } from '@/stores/formStore';
import { useFlowsManagerStore } from '@/stores/flowManagerStore';
import InputPassword from '@/components/core/inputPassword';
import { useNodeStore } from '@/stores/nodeStore';
import useFlowStore from '@/stores/flowStore';
import { useMasterDataStore } from '@/pages/MasterDataPage/constants';
import useSourceNodes from '@/hooks/use-source-nodes';
import InputUpload from '@/components/core/inputUpload';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useMasterDataStores } from "@/pages/MasterDataPage/constants";
import UploadDialog from "@/pages/MasterDataPage/UploadDialog";
import api from "@/controllers/API/api";
import { toast } from "sonner";
import { FileType, FileUploadApiResponse } from "@/pages/MasterDataPage/types";
import { useNavigate } from "react-router-dom";
import BaseModal from "@/modals/baseModal";
import CredCreate from "@/pages/CredVaultPage/CredCreate";
import { Field } from 'react-hook-form';
import { AlternativeSelect } from "@/components/ui/alternative-select";
import { MultiSelectCombobox } from "@/components/ui/multi-select";
import ParameterList from "@/components/common/CustomScripts/components/ParameterList";
import { normalizeMasterDataFilesData } from "@/controllers/API/filesApi";
import {
  ApiRequestError,
  executeApiRequestSilent,
  getDisplayErrorMessage,
  isApiResponseSuccess,
  resolveApiErrorMessage,
} from "@/utils/exceptionHelper";
import {
  checkFieldDependencies,
  checkFieldDependenciesForApiConnector,
} from "@/utils/formDependencyUtils";
import { collectUpstreamColumns } from "@/utils/upstreamColumns";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";

export type Option = {
  value: string;
  label: string;
}

function normalizeKeyValuePairs(val: unknown): { key: string; value: string }[] {
  if (Array.isArray(val)) {
    return val.map((row) => {
      if (row && typeof row === "object" && ("key" in row || "value" in row)) {
        const r = row as { key?: unknown; value?: unknown };
        return { key: String(r.key ?? ""), value: String(r.value ?? "") };
      }
      return { key: "", value: "" };
    });
  }
  if (typeof val === "string" && val.trim()) {
    try {
      return normalizeKeyValuePairs(JSON.parse(val));
    } catch {
      return [];
    }
  }
  if (val && typeof val === "object" && !Array.isArray(val)) {
    return Object.entries(val as Record<string, unknown>).map(([key, v]) => ({
      key,
      value: v == null ? "" : String(v),
    }));
  }
  return [];
}

const DynamicFieldRenderer: React.FC<DynamicFieldRendererProps> = ({
  field,
  value,
  onChange,
  allFormValues,
  compact = false,
}) => {
  const currentNodeData = useFlowsManagerStore((state) => state.currentFlow);
  const { formValues, setFormValue } = useFormStore();
  const selectedNode = useFlowStore((s) =>
    s.currentWorkflow?.data?.nodes?.find((n) => n.selected)
  );
  
  // Use allFormValues if provided, otherwise fall back to formValues from store
  const currentFormValues = allFormValues || formValues;
  const storeKey = field.originalKey || field.key;
  /** Template key without multi-row suffix (`name_row_0` → `name`). */
  const logicalFieldKey =
    typeof field.originalKey === "string" && field.originalKey !== ""
      ? field.originalKey
      : /^(.+)_row_\d+$/.exec(field.key)?.[1] ?? field.key;

  const [sourceNodes, setSourceNodes] = useState<any>([]);
  const [previousNodeColumns, setPreviousNodeColumns] = useState<any>([]);
  

  useEffect(() => {
    if (selectedNode?.id) {
      const sourceNode = useFlowStore.getState().getUpstreamNodes(selectedNode.id);
      setSourceNodes(sourceNode);
      const previousNodeColumns = sourceNode?.[0]?.data?.node?.output?.columns ?? [];
      setPreviousNodeColumns(previousNodeColumns);
    }
  }, [selectedNode?.id]);


  const dynamicOptions = previousNodeColumns?.length > 0 ? previousNodeColumns.map((col: string) => ({
    label: col,
    value: col,
  })) : [];

  const isStringArray = (val: any): val is string[] => {
    return Array.isArray(val) && val.every(item => typeof item === 'string');
  };

  const nodes = useFlowStore((s) => s.currentWorkflow?.data?.nodes);
  const nodeData: any = nodes?.find((n: any) => n.id === selectedNode?.id);

  const upstreamColumnsKey = useFlowStore((s) => {
    const id = s.currentWorkflow?.data?.nodes?.find((n) => n.selected)?.id;
    if (!id) return "";
    const ups = s.getUpstreamNodes(id);
    return ups
      .map((n) => `${n.id}:${(n.data?.node?.output?.columns || []).join("\x1e")}`)
      .join("\x1f");
  });

  const dataEnrichmentUpstreamSelectOptions = useMemo(() => {
    if (nodeData?.data?.node_id !== "data_enrichment") return [] as string[];
    if (
      logicalFieldKey !== "source_column" &&
      logicalFieldKey !== "target_column"
    ) {
      return [] as string[];
    }
    const base = collectUpstreamColumns(selectedNode?.id);
    const rowVal = (currentFormValues as Record<string, unknown>)?.[
      logicalFieldKey
    ];
    const raw =
      value !== undefined && value !== null ? value : rowVal ?? formValues[storeKey];
    const cur =
      typeof raw === "string" || typeof raw === "number" ? String(raw) : "";
    const out = [...base];
    if (cur && !out.includes(cur)) out.unshift(cur);
    return out;
  }, [
    nodeData?.data?.node_id,
    logicalFieldKey,
    selectedNode?.id,
    upstreamColumnsKey,
    value,
    currentFormValues,
    formValues[storeKey],
    storeKey,
  ]);
  const { isUploadDialogOpen, openUploadDialog, closeUploadDialog } = useMasterDataStores();
  const [filesData, setFilesData] = useState<FileType[]>([]);
  const isMountedRef = useRef(true);

  const [open, setOpen] = useState(false)

  // --- Handlers for different input types ---

  const handleChange = (val: string) => {
    // const fieldDef = field as any;
    // if (val === ADD_SOURCE_VALUE && fieldDef.add_source_connection && fieldDef.source_form_id) {
    //   setOpen(true);
    //   return;
    // }
    setFormValue(storeKey, val);
    if (onChange) {
      onChange(field.key, val);
    }
  };

  const handleValueChange = (newValue: FormValue, option?: any) => {  //newValue: Form
    // 1. Update the global store (if you still need it for other purposes)
    setFormValue(storeKey, newValue);

    // 2. CRITICAL: Call the parent's onChange function with the field's internal key and the new value.
    if (onChange) {
      if (field.source_form_id === "master_data" && option) {
        onChange("file_name", option.file_name);
        onChange("file_type", option.file_type);
        onChange("encrypted_file_key", option.encrypted_file_key);
        onChange("sheet_name", option.sheet_name);
      }
      onChange(field.key, newValue);
    }
  };



  const handleMultiDropdownChange = (val: string[]) => {
    // const fieldDef = field as any;
    // if (
    //   val.includes(ADD_SOURCE_VALUE) &&
    //   fieldDef.add_source_connection &&
    //   fieldDef.source_form_id
    // ) {
    setOpen(true);
    return;
    // }
    handleValueChange(val);
  };


  const handleFilterChange = (filters: FilterRow[]) => {
    const stringValue = JSON.stringify(filters);
    setFormValue(storeKey, stringValue);
    if (onChange) {
      onChange(field.key, filters);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const valueToSet = file || null;
    setFormValue(storeKey, valueToSet);
    if (onChange) {
      onChange(field.key, valueToSet);
    }
  };

  // --- Type-safe value getters for rendering ---

  const getFilterValue = (key: string): FilterRow[] => {
    // First check if value prop was passed (from multi-row form)
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        return value;
      }
    }

    // Fall back to store value
    const storedValue: any = formValues[key];
    if (!storedValue) return [];
    try {
      const parsed = JSON.parse(storedValue);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const getMultiDropdownValue = (key: string): string[] => {
    // Prefer NodeForm / parent `allFormValues` over the global zustand store so each node
    // has isolated state (store keys like `match_columns` are not unique per node).
    const fromParentForm =
      allFormValues && typeof allFormValues === "object"
        ? (allFormValues as Record<string, unknown>)[key]
        : undefined;
    const raw =
      fromParentForm !== undefined && fromParentForm !== null
        ? fromParentForm
        : value !== undefined && value !== null
          ? value
          : undefined;

    if (raw !== undefined && raw !== null) {
      if (
        Array.isArray(raw) &&
        raw.every((item) => typeof item === "string" || typeof item === "number")
      ) {
        return raw.map(String);
      }
    }

    const storedValue = formValues[key];
    return Array.isArray(storedValue) && storedValue.every((item) => typeof item === "string")
      ? storedValue
      : [];
  };


  const getOptions = () => {
    if (field?.options?.length > 0 || field?.fetch) {
      return field.options;
    }
    else if (nodeData?.data?.node_id === "concat") {
      return sourceNodes.map((node: any) => ({
        label: node.id,
        // The value is the stringified data array.
        value: JSON.stringify(node?.data?.node?.output?.data || []),
      }));
    } else if (dynamicOptions.length > 0) {
      return dynamicOptions;
    }
    else if (field?.options?.length > 0 || field?.fetch) {
      return field.options;
    } else if (dynamicOptions?.length > 0) {
      return dynamicOptions;
    } else {
      return field?.options;
    }
  };


  // A helper to get a guaranteed string value for simple inputs
  const getCurrentStringValue = (): string => {
    const val = value !== undefined && value !== null ? value : formValues[storeKey];
    return typeof val === "string" || typeof val === "number" ? String(val) : "";
  };

  const getCurrentBoolValue = (): boolean => {
    const val = value !== undefined && value !== null ? value : formValues[storeKey];
    if (val === true || val === "true" || val === 1 || val === "1") return true;
    return false;
  };

  // --- Logic for dependent fields ---

  const getFetchConfig = (fetchConfig: FetchAPIParams | undefined) => {
    if (!fetchConfig) return undefined;
    const updatedConfig = { ...fetchConfig };
    if (updatedConfig.params) {
      Object.entries(updatedConfig.params).forEach(([key, value]) => {
        if (typeof value === "string" && value.includes("{{")) {
          const match = value.match(/{{(.*?)}}/);
          if (match && match[1]) {
            const formKey = match[1];
            const formValue = formValues[formKey];
            updatedConfig.params[key] = typeof formValue === 'string' ? formValue : '';
          }
        }
      });
    }
    return updatedConfig;
  };

  const getCurrentValue = () => {
    const val = value !== undefined && value !== null ? value : formValues[storeKey];

    if (
      typeof val === 'string' ||
      typeof val === 'number' ||
      typeof val === 'boolean' ||
      Array.isArray(val) ||
      (val && typeof val === 'object' && !Array.isArray(val))
    ) {
      return val;
    }

    return "";
  };

  // --- Effect for initialization ---
  useEffect(() => {
    const initialNodeValue = currentNodeData?.data?.nodes?.[field.key];
    if (formValues[field.key] === undefined && initialNodeValue !== undefined) {
      setFormValue(field.key, initialNodeValue);
    }
  }, [field.key, currentNodeData?.data?.nodes]);

  const fetchFiles = useCallback(async () => {
    try {
      const response = await api.post<{
        status: boolean;
        message: string;
        data: FileType[];
      }>("/api/files/get-files", {
        file_category: "master_data",
        fields: JSON.stringify([
          "unique_id as value",
          "display_name as label",
          "file_name",
          "file_type",
          "encrypted_file_key",
          "sheet_name",
        ]),
      });
      const body = response.data;
      const files = normalizeMasterDataFilesData(body?.data);
      if (isMountedRef.current && files) {
        const sortedFiles = (files as FileType[]).sort(
          (a, b) =>
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        );
        setFilesData(sortedFiles);
      } else if (isMountedRef.current) {
        if (isApiResponseSuccess(body?.status)) {
          setFilesData([]);
        } else {
          toast.error(
            resolveApiErrorMessage(body, "Received invalid data format for files."),
          );
          setFilesData([]);
        }
      }
    } catch (error: unknown) {
      console.error("Error fetching files:", error);
      if (isMountedRef.current) {
        toast.error(getDisplayErrorMessage(error, "Failed to fetch files."));
        setFilesData([]);
      }
    }
  }, []);

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
        created_by: "",
        updated_by: "",
      };

      try {
        await api.post("/api/files/create-file", payload);
        if (isMountedRef.current) {
          toast.success(`File "${payload.display_name}" created successfully!`);
          fetchFiles();
          closeUploadDialog();
        }
      } catch (error: any) {
        console.error("Error creating file:", error);
        if (isMountedRef.current) {
          toast.error(getDisplayErrorMessage(error, `Failed to create file "${payload.display_name}".`));
        }
      }
    },
    [fetchFiles, closeUploadDialog]
  ); // fetchFiles is stable

  const handleUploadWithFetch = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) {
        setFormValue(storeKey, null);
        onChange?.(field.key, null);
        return;
      }
      const fetchCfg = field.fetch;
      if (!fetchCfg?.module || !fetchCfg.klass) {
        toast.error("Upload is not configured for this field.");
        return;
      }
      const formData = new FormData();
      const paramName =
        fetchCfg.params && typeof fetchCfg.params === "object"
          ? Object.keys(fetchCfg.params)[0]
          : "upload_file";
      formData.append(paramName, file);
      try {
        const json = await executeApiRequestSilent<{
          status?: boolean;
          message?: string;
          data?: unknown;
        }>(
          () =>
            api.post(`/${fetchCfg.module}/${fetchCfg.klass}`, formData, {
              headers: { "Content-Type": "multipart/form-data" },
            }),
          "Upload failed",
        );
        const data = (json as { data?: unknown })?.data ?? json;
        setFormValue(storeKey, data);
        onChange?.(field.key, data);
        toast.success(json?.message || "File uploaded successfully");
      } catch (err: unknown) {
        if (!(err instanceof ApiRequestError)) {
          toast.error(getDisplayErrorMessage(err, "Upload failed"));
        }
      }
    },
    [field.fetch, field.key, onChange, setFormValue, storeKey]
  );

  const uploadInitialFileName =
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "file_name" in value
      ? String((value as { file_name?: string }).file_name ?? "")
      : "";

  const nodeIdForDeps = nodeData?.data?.node_id as string | undefined;
  const isFieldVisible = (): boolean => {
    const vals = currentFormValues as FormSubmissionData;
    if (nodeIdForDeps === "api_connector" || nodeIdForDeps === "data_enrichment") {
      return checkFieldDependenciesForApiConnector(field, vals);
    }
    return checkFieldDependencies(field, vals);
  };

  if (!isFieldVisible()) {
    return null;
  }

  const isDataEnrichmentUpstreamColumnField =
    nodeData?.data?.node_id === "data_enrichment" &&
    (logicalFieldKey === "source_column" ||
      logicalFieldKey === "target_column");

  const hideInfoForConnector = nodeData?.data?.node_id === "api_connector";
  const infoProp = hideInfoForConnector ? undefined : field.info;

  if (isDataEnrichmentUpstreamColumnField) {
    const options = dataEnrichmentUpstreamSelectOptions;
    const strVal = getCurrentStringValue();
    return (
      <div
        className={
          compact
            ? "flex w-full flex-col gap-1"
            : "flex w-full flex-col gap-1.5"
        }
      >
        <div className="flex items-center gap-1">
          <Label htmlFor={field.key}>
            {field.display_name}{" "}
            {field.required && <span className="text-slate-700">*</span>}
          </Label>
          {infoProp && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 cursor-help text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>{infoProp}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <Select
          value={strVal || undefined}
          onValueChange={(v) => {
            if (field.originalKey) {
              onChange?.(field.key, v);
            } else {
              handleChange(v);
            }
          }}
          disabled={options.length === 0}
        >
          <SelectTrigger id={field.key} className="w-full bg-background">
            <SelectValue
              placeholder={
                options.length === 0
                  ? "No upstream columns"
                  : field.placeholder || "Select column"
              }
            />
          </SelectTrigger>
          <SelectContent>
            {options.map((col) => (
              <SelectItem key={`${field.key}-${col}`} value={col}>
                {col}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {options.length === 0 && (
          <p
            className={cn(
              "text-xs text-amber-700 dark:text-amber-400"
            )}
          >
            Connect this node to an upstream node with output columns, or run the upstream node
            so column metadata is available.
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      <div
        className={
          compact
            ? "flex w-full flex-col gap-1"
            : "flex w-full flex-col gap-1.5"
        }
      >
        {field.type === "text" && (
          <InputText
            id={field.key}
            name={field.key}
            displayName={field.display_name}
            placeholder={field.placeholder}
            info={infoProp}
            required={field.required}
            position={field.position}
            value={getCurrentStringValue()}
            onChange={(e) => handleChange(e.target.value)}
          />
        )}

        {field.type === "password" && (
          <InputPassword
            id={field.key}
            name={field.key}
            displayName={field.display_name}
            placeholder={field.placeholder}
            info={infoProp}
            required={field.required}
            position={field.position}
            value={getCurrentStringValue()}
            onChange={(e) => handleChange(e.target.value)}
          />
        )}

        {field.type === "checkbox" && (
          <div
            className={cn("flex w-full", compact ? "flex-col gap-1" : "flex-col gap-1.5")}
          >
            <div className="flex items-start gap-2.5">
              <Checkbox
                id={field.key}
                className="mt-0.5"
                checked={getCurrentBoolValue()}
                onCheckedChange={(c) => handleValueChange(c === true)}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex items-center gap-1">
                  <Label htmlFor={field.key} className="cursor-pointer text-sm font-normal leading-snug">
                    {field.display_name}
                    {field.required && <span className="text-slate-700"> *</span>}
                  </Label>
                  {infoProp && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 shrink-0 cursor-help text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{infoProp}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {field.type === "dropdown" && (() => {
          const useRemoteOptions =
            !!field.fetch && (!field.options || field.options.length === 0);

          if (useRemoteOptions) {
            return (
              <InputDropdown
                id={field.key}
                name={field.key}
                displayName={field.display_name}
                placeholder={field.placeholder || "Select an option..."}
                required={field.required}
                info={infoProp}
                value={getCurrentStringValue()}
                options={field.options}
                fetch={field.fetch}
                formValues={currentFormValues as Record<string, string>}
                showAddButton={(field as any).add_source_connection}
                onAddClick={() => setOpen(true)}
                addButtonLabel={
                  (field as any).source_form_name
                    ? (field as any).source_form_name
                    : "Add new dataset"
                }
                onChange={(v) => handleValueChange(v)}
              />
            );
          }

          const options = getOptions();
          return (
            <div className="flex flex-col gap-1.5 w-full">
              <div className="flex items-center gap-1">
                <Label htmlFor={field.key}>
                  {field.display_name}{" "}
                  {field.required && <span className="text-slate-700">*</span>}
                </Label>
                {infoProp && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{infoProp}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              <AlternativeSelect
                key={`${field.key}-${options?.length}`}
                options={options || []}
                value={getCurrentStringValue()}
                onChange={handleValueChange}
                placeholder={field.placeholder || "Select an option..."}
                showAddButton={(field as any).add_source_connection}
                onAddClick={() => {
                  setOpen(true);
                }}
                addButtonLabel={(field as any).source_form_name ? (field as any).source_form_name : "Add new dataset"}
              />
            </div>
          );
        })()}

        {field.type === "multi-dropdown" && (() => {
          const options = getOptions();
          return (
            <div className="flex flex-col gap-1.5 w-full">
              <div className="flex items-center gap-1">
                <Label htmlFor={field.key}>
                  {field.display_name}{" "}
                  {field.required && <span className="text-slate-700">*</span>}
                </Label>
                {infoProp && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{infoProp}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              <MultiSelectCombobox
                key={`${field.key}-${options?.length}`}
                options={options || []}
                value={getMultiDropdownValue(storeKey)}
                onChange={handleValueChange}
                placeholder={field.placeholder || "Select options..."}
                showAddButton={(field as any).add_source_connection}
                onAddClick={() => {
                  setOpen(true);
                }}
                addButtonLabel={(field as any).source_form_name ? (field as any).source_form_name : "Add new dataset"}
              />
            </div>
          );
        })()}

        {field.type === "textarea" && (
          <InputTextArea
            name={field.key}
            displayName={field.display_name}
            id={field.key}
            placeholder={field.placeholder}
            info={infoProp}
            required={field.required}
            position={field.position}
            value={getCurrentStringValue()}
            onChange={(e) => handleChange(e.target.value)}
          />
        )}

        {field.type === "key-value" && (() => {
          const isConnectorTable = nodeData?.data?.node_id === "api_connector";
          const title =
            `${field.display_name}${field.required ? " *" : ""}`.trim();
          const hint = [field.info, field.placeholder]
            .filter((s): s is string => typeof s === "string" && s.trim() !== "")
            .join("\n");

          if (isConnectorTable) {
            return (
              <div className="flex w-full flex-col gap-1">
                <ParameterList
                  label={title}
                  hint={hint || undefined}
                  layout="table"
                  tableBorderless
                  parameters={normalizeKeyValuePairs(
                    value !== undefined && value !== null ? value : getCurrentValue()
                  )}
                  onChange={(next) => handleValueChange(next)}
                />
              </div>
            );
          }

          return (
            <div className="flex w-full flex-col gap-1.5">
              <div className="flex items-center gap-1">
                <Label htmlFor={field.key}>
                  {field.display_name}{" "}
                  {field.required && <span className="text-slate-700">*</span>}
                </Label>
                {infoProp && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{infoProp}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              <ParameterList
                label={field.placeholder || "Entries"}
                parameters={normalizeKeyValuePairs(
                  value !== undefined && value !== null ? value : getCurrentValue()
                )}
                onChange={(next) => handleValueChange(next)}
              />
            </div>
          );
        })()}

        {field.type === "filter-text" && (
          <InputFilterForm
            name={field.key}
            displayName={field.display_name}
            placeholder={field.placeholder}
            info={infoProp}
            required={field.required}
            position={field.position}
            value={getFilterValue(storeKey)}
            onChange={handleFilterChange}
          />
        )}

        {field.type === "upload" &&
          (nodeData?.data?.node_id === "master_data" ? (
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <Label htmlFor={field.key}>
                  {field.display_name}{" "}
                  {field.required && <span className="text-slate-700">*</span>}
                </Label>
                {infoProp && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{infoProp}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              <Button
                onClick={openUploadDialog}
                variant="default"
                className="!px-3 md:!px-4 md:!pl-3.5"
                size="sm"
              >
                <Plus aria-hidden="false" className="h-4 w-4" />
                <span className="hidden whitespace-nowrap font-semibold md:inline ml-2">
                  Upload
                </span>
              </Button>
            </div>
          ) : field.fetch ? (
            <InputUpload
              name={field.key}
              displayName={field.display_name}
              required={field.required}
              info={infoProp}
              initialFileName={uploadInitialFileName}
              onChange={(ev) => {
                void handleUploadWithFetch(ev);
              }}
            />
          ) : (
            <InputUpload
              name={field.key}
              displayName={field.display_name}
              required={field.required}
              info={infoProp}
              onChange={handleFileChange}
            />
          ))}

        <UploadDialog
          isOpen={isUploadDialogOpen}
          onClose={closeUploadDialog}
          onUploadProcessComplete={handleUploadProcessComplete}
        />
      </div>

      <BaseModal size="x-large" open={open} setOpen={setOpen}>
        <BaseModal.Header>
          <span>{(field as { source_form_name?: string }).source_form_name ?? "Create connection"}</span>
        </BaseModal.Header>
        <BaseModal.Content>
          <CredCreate sourceFormId={field.source_form_id} showBackButtonIf={"false"} />
        </BaseModal.Content>
      </BaseModal>

    </>
  );
}

export default DynamicFieldRenderer;
