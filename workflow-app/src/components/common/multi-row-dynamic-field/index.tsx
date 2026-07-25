import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  BetweenVerticalEnd,
  Columns3Cog,
  ColumnsSettings,
  FilterIcon,
  FunnelPlus,
  Plus,
  Sparkles,
  X,
  Columns3,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import AiIcon from "@/assets/images/icons8-ai-64.png";
import DynamicFieldRenderer from "../dynamic-field-render";
import { AgGridReact } from "ag-grid-react";
import {
  FilterChangedEvent,
  FilterModifiedEvent,
  TextFilterParams,
} from "ag-grid-community";
import { useAgGridTheme } from "@/hooks/useAgGridTheme";
import "@/styles/ag-grid-theme-sync.css";
import useFlowStore from "@/stores/flowStore";
import { SetCustomColumn } from "../setCustomColumn/components/customColumn";
import BaseModal from "@/modals/baseModal";
import {
  Command,
  CommandInput,
  CommandItem,
  CommandEmpty,
  CommandGroup,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { mapAgGridConditionToCustom } from "@/utils/utils";
import InputFilterForm from "@/components/core/inputFilterForm";
import FilterCreation from "../FilterCreation";
import { useFlowsManagerStore } from "@/stores/flowManagerStore";
import useSourceNodes from "@/hooks/use-source-nodes";
import useExecutionResultStore from "@/stores/executionResultStore";
import { useNodeStore } from "@/stores/nodeStore";
// import { FormValue } from '@/types/form';
import {
  FieldTemplate,
  FilterRow,
  FormSubmissionData,
  FormValue,
} from "@/types/form";
import SmartCellRenderer from "@/components/core/cellRenderer";
import { ModuleRegistry, AllCommunityModule } from "ag-grid-community";
import ConditionalFilter from "../ConditionalFilter";
import DataValidationTable from "../dataValidation/components/data-validation-table";
import { DialogDescription } from "@radix-ui/react-dialog";
import { saveNodeDetailsApi } from "@/controllers/API";
import { toast } from "sonner";
import { ApiRequestError, getDisplayErrorMessage } from "@/utils/exceptionHelper";
import DeriveColumn from "../deriveColumn";
import DataFilters, { DataFiltersRef } from "../DataFilters";
import { useValidationStore } from "@/stores/validationStore";
import { hydrateNodeOutputAfterExecution } from "@/utils/nodeDataUtils";
import { FiltersPageView } from "@/pages/RuleConfiguration/components/FiltersPageView";
import FilterOperations, { FilterOperationsRef } from "../FilterOperations";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import CodeEditor from "@/components/core/filterCodeEditor";

ModuleRegistry.registerModules([AllCommunityModule]);

type ModalSourceDataPreviewProps = {
  colDefs: { field: string; headerName: string }[];
  rowData: Record<string, unknown>[];
  agTheme: ReturnType<typeof useAgGridTheme>["agTheme"];
  themeKey: string;
};

function ModalSourceDataPreview({ colDefs, rowData, agTheme, themeKey }: ModalSourceDataPreviewProps) {
  const [isVisible, setIsVisible] = useState(true);

  if (!colDefs?.length) {
    return (
      <p className="text-sm text-muted-foreground px-1 py-2">
        No source data available. Execute the upstream node first.
      </p>
    );
  }

  return (
    <Card className="w-full py-2 gap-0.5 shrink-0">
      <CardHeader className="px-2 pt-0 pb-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setIsVisible((v) => !v)}
            >
              {isVisible ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
            <CardTitle className="text-sm font-semibold p-0">Source Data Preview</CardTitle>
          </div>
          <span className="text-xs text-muted-foreground">
            {rowData?.length ?? 0} row{(rowData?.length ?? 0) !== 1 ? "s" : ""}
          </span>
        </div>
      </CardHeader>
      {isVisible && (
        <CardContent className="p-0 px-2 pb-2">
          <div className={cn("ag-grid-theme-sync h-[220px] w-full")}>
            <AgGridReact
              key={`modal-source-preview-${themeKey}`}
              rowData={rowData || []}
              theme={agTheme}
              gridOptions={{ suppressFieldDotNotation: true }}
              columnDefs={colDefs}
              defaultColDef={{
                editable: false,
                cellRenderer: SmartCellRenderer,
              }}
              pagination
              paginationPageSize={50}
              paginationPageSizeSelector={[25, 50, 100]}
              cellSelection
              enableCellTextSelection
              ensureDomOrder
            />
          </div>
        </CardContent>
      )}
    </Card>
  );
}

/** Data enrichment: one preview call per configuration row (wired from NodeForm). */
export type PerRowDataPreviewConfig = {
  enabled: boolean;
  disabled?: boolean;
  onPreviewRow: (rowId: number) => void | Promise<void>;
};

interface MultiRowFormProps {
  template: Record<string, FieldTemplate>;
  onFormChange: (formData: any[]) => void;
  data: any[];
  onClickSave: (filterType?: string, data?: any, sourceId?: string) => void | Promise<void>;
  systemFilters: any[]; // Array of filter condition objects: { id, index, filter, filter_type, sourceId? }
  perRowDataPreview?: PerRowDataPreviewConfig;
  // Optional props for Column Filters
  connections?: any[];
  dataSources?: any[];
  connectionKeyStates?: any;
  getConnectionKeyState?: (connectionId: string) => { isPrimaryKey: boolean; isValidationKey: boolean };
  onColumnSelect?: (column: { name: string; type: string; table?: string; isSource: boolean; isTarget: boolean } | null) => void;
  onFiltersChange?: (filters: any) => void;
  sourceId?: string; // Source ID for per-source filter isolation
  activeRuleId?: string; // Active rule ID for validation store deletion
  activeRuleName?: string | null; // Active rule name for rule-specific filter isolation
}

type FilterType = "auto" | "manual" | "ai_generated";

type ExecuteItem = {
  id: string;
  code: string;
  filter_type: FilterType;
  sourceId?: string;
  user_request?: string;
};

const MultiRowDynamicForm: React.FC<MultiRowFormProps> = ({
  template,
  onFormChange,
  data,
  onClickSave,
  systemFilters,
  perRowDataPreview,
  connections = [],
  dataSources = [],
  connectionKeyStates = {},
  getConnectionKeyState = () => ({ isPrimaryKey: false, isValidationKey: false }),
  onColumnSelect = () => { },
  onFiltersChange = () => { },
  sourceId,
  activeRuleId,
  activeRuleName,
}) => {
  const renderData = data.length > 0 ? data : [{}];
  const rows = renderData.map((_, index) => index);

  const [formData, setFormData] = useState<
    Record<number, Record<string, FormValue>>
  >({
    0: {},
  });

  const [isDeriveColumn, setIsDeriveColumn] = useState(false);
  const [customColumn, setCustomColumn] = useState(false);
  const [condFilter, setCondFilter] = useState(false);
  const [dataFilters, setDataFilters] = useState(false);
  const [showColumnFilters, setShowColumnFilters] = useState(false);
  const [showFilterOperations, setShowFilterOperations] = useState(false);
  const [filterOperationType, setFilterOperationType] = useState<'derive_column' | 'data_filter' | ''>('');
  const [selectedColumnForFilter, setSelectedColumnForFilter] = useState<{ name: string; type: string; table?: string; isSource: boolean; isTarget: boolean } | null>(null);
  const [showAiPanel, setShowAiPanel] = useState(false);

  // Set default operation type when Filter Operations modal opens
  useEffect(() => {
    if (showFilterOperations) {
      // Set default type if not already set
      if (!filterOperationType) {
        const defaultType = 'derive_column';
        setFilterOperationType(defaultType);
      }
      // Always sync the FilterOperations component when modal opens
      setTimeout(() => {
        filterOperationsRef.current?.setOperationType(filterOperationType || 'derive_column');
      }, 0);
    }
  }, [showFilterOperations]);

  const [isFilter, setIsFilter] = useState(false);
  const nodes = useFlowStore.getState().currentWorkflow?.data?.nodes;
  const edges = useFlowStore.getState().currentWorkflow?.data?.edges;
  // const { sourceNodes }: { sourceNodes: any[] } = useSourceNodes();
  const [sourceNodes, setSourceNodes] = useState<any[]>([]);

  const executionResult = useExecutionResultStore((state) => state.result);
  const selectedNode = useFlowStore((state) => state.getSelectedNode());
  const hideGridNodeIds = [
    "add_column",
    "drop_column",
    "rename_column",
    "sort_data",
    "data_enrichment",
  ];
  const shouldHideGrid =
    selectedNode?.data?.node_id &&
    hideGridNodeIds.includes(selectedNode.data.node_id);
  const [previewDeriveData, setPreviewDeriveData] = useState(null);
  const [initialData, setInitialData] = useState([]);
  const [editingFilterData, setEditingFilterData] = useState<any>(null);
  const [columns, setColumns] = useState([]);
  const dataFiltersRef = useRef<DataFiltersRef>(null);
  const filterOperationsRef = useRef<FilterOperationsRef>(null);
  const sidebarOptionsRef = useRef<HTMLDivElement>(null);

  const [singleFieldData, setSingleFieldData] = useState<
    Record<string, FormValue>
  >({});

  // Store filter state per source to preserve when switching tabs
  const filterStateBySourceRef = useRef<Record<string, { initialData: any[]; singleFieldData: any }>>({});

  useEffect(() => {
    if (selectedNode?.id) {
      setSourceNodes(useFlowStore.getState().getUpstreamNodes(selectedNode?.id || ''));
    }
  }, [selectedNode]);

  useEffect(() => {
    // Check if we have stored state for this source first
    const storedState = sourceId ? filterStateBySourceRef.current[sourceId] : null;

    // Filter systemFilters by sourceId if provided (for per-source isolation)
    let filteredFilters = systemFilters;
    if (sourceId && Array.isArray(systemFilters)) {
      filteredFilters = systemFilters.filter((filter) => {
        // If filter has sourceId property, only include if it matches
        if (filter && typeof filter === 'object' && filter.sourceId !== undefined) {
          return filter.sourceId === sourceId;
        }
        // If no sourceId, include it (for backward compatibility)
        return true;
      });
    }

    // If we have filters from props, use them and update stored state
    if (Array.isArray(filteredFilters) && filteredFilters?.length > 0) {
      // systemFilters can be array of strings or objects with { id, index, filter, filter_type }
      const systemFilterObjects = filteredFilters.map((filter, index) => {
        // If it's already an object with filter property, use it as-is
        if (typeof filter === 'object' && filter.filter !== undefined) {
          return {
            id: filter.id || `filter-${index}-${Date.now()}`,
            index: filter.index !== undefined ? filter.index : index,
            value: filter.filter,
            filter: filter.filter,
            filter_type: filter.filter_type || 'auto',
            sourceId: filter.sourceId || sourceId,
          };
        }
        // Legacy: if it's a string, convert to object format
        return {
          index: index,
          value: typeof filter === 'string' ? filter : JSON.stringify(filter),
          filter: typeof filter === 'string' ? filter : JSON.stringify(filter),
          filter_type: 'auto',
          sourceId: sourceId,
        };
      });

      setSingleFieldData((prev: any) => {
        return { ...prev, filter_conditions: systemFilterObjects };
      });

      // Set initialData for CodeEditor - it expects objects with { id, filter, filter_type }
      const codeEditorData = filteredFilters.map((filter, index) => {
        if (typeof filter === 'object' && filter.filter !== undefined) {
          return {
            id: filter.id || `filter-${index}-${Date.now()}`,
            filter: filter.filter,
            filter_type: filter.filter_type || 'auto',
            index: filter.index !== undefined ? filter.index : index,
            sourceId: filter.sourceId || sourceId,
            user_request: filter.user_request,
          };
        }
        return {
          id: `filter-${index}-${Date.now()}`,
          filter: typeof filter === 'string' ? filter : JSON.stringify(filter),
          filter_type: 'auto',
          index: index,
          sourceId: sourceId,
        };
      });
      setInitialData(codeEditorData);

      // Store state for this source - always update when we have new filters
      if (sourceId) {
        filterStateBySourceRef.current[sourceId] = {
          initialData: codeEditorData,
          singleFieldData: { filter_conditions: systemFilterObjects }
        };
      }
    } else if (storedState && sourceId) {
      // If no filters from props but we have stored state, restore it
      // This preserves filters when switching tabs, closing modals, or navigating back
      // Always restore from stored state to preserve filters after modal closes
      setInitialData(storedState.initialData);
      setSingleFieldData((prev: any) => ({
        ...prev,
        ...storedState.singleFieldData
      }));
    } else if (!sourceId) {
      // Only clear if we don't have sourceId (backward compatibility)
      if (!storedState) {
        setInitialData([]);
        setSingleFieldData((prev: any) => {
          const updated = { ...prev };
          delete updated.filter_conditions;
          return updated;
        });
      }
    }
    // If sourceId exists but no filters and no stored state, keep current state (don't clear)
    // This ensures filters persist even when systemFilters is temporarily empty
  }, [systemFilters, sourceId]);

  const formDataForComparison = useMemo(() => {
    // We must sort by rowId (the object key) to ensure a stable string for comparison.
    const sortedKeys = Object.keys(formData).sort(
      (a, b) => Number(a) - Number(b)
    );
    const sortedData = sortedKeys.map((key) => formData[key]);
    return JSON.stringify(sortedData);
  }, [formData]);

  // Extract filters fields from template.filters array

  const getFiltersFields = (): FieldTemplate[] => {
    if (
      template.filters &&
      Array.isArray(template.filters) &&
      template.filters.length > 0
    ) {
      const filtersObject = template.filters[0] as Record<string, any>;
      return Object.values(filtersObject).map(
        (field) => field as FieldTemplate
      );
    }
    return [];
  };

  const filtersFields = getFiltersFields();

  const singleFields = Object.values(template).filter(
    (field) =>
      field &&
      typeof field === "object" &&
      typeof field.key === "string" &&
      field.key !== "filters" &&
      field.type !== undefined
  );
  const isDataEnrichmentFlatMulti =
    selectedNode?.data?.node_id === "data_enrichment";
  const isChainingForm =
    isDataEnrichmentFlatMulti ||
    (singleFields.length === 0 && template.hasOwnProperty("filters"));

  const handleFieldChange = useCallback(
    (rowId: number, fieldKey: string, value: FormValue) => {
      setFormData((prev) => {
        const updatedFormData = {
          ...prev,
          [rowId]: { ...prev[rowId], [fieldKey]: value },
        };
        updateParentFormData(updatedFormData, singleFieldData);
        return updatedFormData;
      });
    },
    [singleFieldData]
  );

  const handleSingleFieldChange = useCallback(
    (fieldKey: string, value: FormValue) => {
      setSingleFieldData((prev) => {
        const updatedSingleFieldData = { ...prev, [fieldKey]: value };
        updateParentFormData(formData, updatedSingleFieldData);
        return updatedSingleFieldData;
      });
    },
    [formData]
  );

  const updateParentFormData = useCallback(
    (
      multiRowData: Record<number, Record<string, FormValue>>,
      singleFieldData: Record<string, FormValue>
    ) => {
      const filtersArray = Object.values(multiRowData);

      if (isChainingForm) {
        // For add_column, etc., pass a simple array of row data
        onFormChange(filtersArray);
      } else {
        // For filter_data, retain the original complex object structure
        const combinedData = { filters: filtersArray, ...singleFieldData };
        onFormChange([combinedData]);
      }
    },
    [onFormChange, isChainingForm]
  );

  const addRow = useCallback(() => {
    // Create a new array by appending an empty object.
    const newData = [...data, {}];
    // Inform the parent (`NodeForm`) of the complete new state.
    onFormChange(newData);
  }, [data, onFormChange]);

  const removeRow = useCallback(
    (rowId: number) => {
      // The component should not remove its last row.
      const canRemove = data.length > 1;
      if (canRemove) {
        // Create a new array by filtering out the specified row.
        const newData = data.filter((_, index) => index !== rowId);
        onFormChange(newData);
      }
    },
    [data, onFormChange]
  );

  const getFieldValue = useCallback(
    (rowId: number, fieldKey: string): FormValue => {
      return data[rowId]?.[fieldKey] ?? "";
    },
    [data]
  );

  const getSingleFieldValue = useCallback(
    (fieldKey: string): FormValue => {
      return singleFieldData[fieldKey] || null;
    },
    [singleFieldData]
  );

  // Sort filter fields by position
  const sortedFilterFields = filtersFields.sort(
    (a, b) => (a.position || 0) - (b.position || 0)
  );

  // Sort single fields by position
  const sortedSingleFields = singleFields.sort(
    (a, b) => ((a as any).position || 0) - ((b as any).position || 0)
  );

  const { agTheme, theme: appTheme } = useAgGridTheme();
  const [colDefs, setColDefs] = useState([]);
  const [rowData, setRowData] = useState([]);

  // Multi-source output (e.g. N-way matching: { data: { VBAK_DATA: [...], VBAP_DATA: [...] } })
  const isMultiSourceOutput = (output: any): boolean => {
    if (!output?.data || typeof output.data !== 'object' || Array.isArray(output.data)) return false;
    return Object.values(output.data).every((v: any) => Array.isArray(v));
  };
  const [sourceNames, setSourceNames] = useState<string[]>([]);
  const [selectedSourceKey, setSelectedSourceKey] = useState<string | null>(null);

  useEffect(() => {
    const prevOutput = sourceNodes?.[0]?.data?.node?.output;
    if (prevOutput) console.log('Previous node output:', prevOutput);

    // Filter / filter_data: configuration grid must always show upstream (previous node) data.
    // Filtered output belongs in Data Preview (node output + sheet), not in this editor table.
    const nodeDataLayer = selectedNode?.data as Record<string, unknown> | undefined;
    const innerNode = nodeDataLayer?.node as Record<string, unknown> | undefined;
    const isFilterStyleNode =
      selectedNode?.data?.node_id === "filter_data" ||
      nodeDataLayer?.type === "Filter" ||
      innerNode?.type === "Filter";

    if (selectedNode?.id === executionResult?.id && !isFilterStyleNode) {
      if (
        executionResult?.data?.length > 0 &&
        executionResult?.columns?.length > 0
      ) {
        const columns =
          executionResult?.columns.map((column: any) => ({
            field: column,
            headerName: column,
            filter: "agTextColumnFilter",
            filterParams: { closeOnApply: true } as TextFilterParams,
          })) || [];
        setColDefs(columns);
        setRowData(executionResult.data);
        setSourceNames([]);
        setSelectedSourceKey(null);
      } else {
        const columns =
          sourceNodes[0]?.data?.node?.output?.columns?.map((column: any) => ({
            field: column,
            headerName: column,
            filter: "agTextColumnFilter",
            filterParams: { closeOnApply: true } as TextFilterParams,
          })) || [];
        setColDefs(columns);
        const rowData = sourceNodes[0]?.data?.node?.output?.data || [];
        setRowData(rowData);
        setColumns(sourceNodes[0]?.data?.node?.output?.columns);
        setSourceNames([]);
        setSelectedSourceKey(null);
      }
    } else if (sourceNodes && sourceNodes.length > 0 && sourceNodes[0]?.data?.node?.output) {

      const output = sourceNodes[0]?.data?.node?.output;
      let columns: any[] = [];
      let data: any[] = [];

      if (isMultiSourceOutput(output)) {
        const names = Object.keys(output.data);
        setSourceNames(names);
        const key = selectedSourceKey && names.includes(selectedSourceKey) ? selectedSourceKey : (names[0] || null);
        if (key !== selectedSourceKey) setSelectedSourceKey(key);
        const sourceArray = key ? (output.data[key] || []) : [];
        data = Array.isArray(sourceArray) ? sourceArray : [];
        columns = data.length > 0 && data[0] ? Object.keys(data[0]) : [];
      } else {
        setSourceNames([]);
        setSelectedSourceKey(null);
        // Handle different output structures (same logic as sheet component)
        if (output.columns && output.data) {
          columns = output.columns;
          data = output.data;
        } else if (output.data?.columns && output.data?.data) {
          columns = output.data.columns;
          data = output.data.data;
        } else if (Array.isArray(output.data) && output.data.length > 0) {
          data = output.data;
          columns = Object.keys(output.data[0] || {});
        } else if (Array.isArray(output) && output.length > 0) {
          data = output;
          columns = Object.keys(output[0] || {});
        }
      }

      if (columns.length > 0 && data.length > 0) {
        const colDefs = columns.map((column: any) => ({
          field: typeof column === 'string' ? column : String(column),
          headerName: typeof column === 'string' ? column : String(column),
          filter: "agTextColumnFilter",
          filterParams: { closeOnApply: true } as TextFilterParams,
        }));
        setColDefs(colDefs);
        setRowData(data);
        setColumns(columns);
      } else {
        setColDefs([]);
        setRowData([]);
      }
    } else {
      setColDefs([]);
      setRowData([]);
      setSourceNames([]);
      setSelectedSourceKey(null);
    }
  }, [edges, executionResult, sourceNodes, selectedSourceKey]);

  useEffect(() => {
    if (data && data.length > 0) {
      setFormData((prevFormData) => {
        const newFormData: Record<number, Record<string, FormValue>> = {};
        data.forEach((rowData, index) => {
          // Merge existing formData with incoming data to preserve user edits
          newFormData[index] = {
            ...rowData,
            ...prevFormData[index], // Preserve any unsaved changes
          };
        });
        return newFormData;
      });
    }
  }, [data]);

  const handleClick = (e: any) => {
    e.preventDefault();
    switch (e.target.textContent) {
      case "Derive Column":
        setIsDeriveColumn(true);
        setPreviewDeriveData({});
        break;
      case "Filter":
        onClickSave("filter");
        break;
      case "Custom Filter":
        setIsFilter(true);
        break;
      case "Set Custom Columns":
        setCustomColumn(true);
        setPreviewDeriveData({});
        break;
      case "Conditional Filters":
        setCondFilter(true);
        break;
      case "Data Filters":
        setDataFilters(true);
        setPreviewDeriveData({});
        break;
      case "Filter Operations":
        setShowFilterOperations(true);
        break;
      case "Column Filters":
        setShowColumnFilters(true);
        break;
      case "Set As Headers":
        break;
      case "Extract Data":
        break;
      case "Extract From File":
        break;
      default:
        break;
    }
  };

  const onFilterChanged = useCallback((e: FilterChangedEvent) => {
    const filterModel = e.api.getFilterModel();
    // console.log("Raw filterModel =>", filterModel);

    // Transform AG Grid filter model to your desired format
    const transformedFilters = [];

    if (filterModel) {
      Object.keys(filterModel).forEach((columnKey) => {
        const filter = filterModel[columnKey];

        if (filter) {
          // Handle different filter types
          if (filter.filterType === "text" || filter.type) {
            // Text filter
            const condition = mapAgGridConditionToCustom(
              filter.type || filter.filterType
            );

            if (
              filter.filter !== undefined &&
              filter.filter !== null &&
              filter.filter !== ""
            ) {
              transformedFilters.push({
                column: columnKey,
                condition: condition,
                value: filter.filter,
              });
            }
          } else if (filter.filterType === "number") {
            // Number filter
            const condition = mapAgGridConditionToCustom(filter.type);

            if (filter.filter !== undefined && filter.filter !== null) {
              transformedFilters.push({
                column: columnKey,
                condition: condition,
                value: filter.filter,
              });
            }
          } else if (filter.filterType === "date") {
            // Date filter
            const condition = mapAgGridConditionToCustom(filter.type);

            if (filter.dateFrom) {
              transformedFilters.push({
                column: columnKey,
                condition: condition,
                value: filter.dateFrom,
              });
            }
          }
          // Handle combined filters (AND/OR conditions)
          else if (filter.operator) {
            // This handles complex filters with multiple conditions
            if (filter.condition1 && filter.condition1.filter) {
              transformedFilters.push({
                column: columnKey,
                condition: mapAgGridConditionToCustom(filter.condition1.type),
                value: filter.condition1.filter,
              });
            }
            if (filter.condition2 && filter.condition2.filter) {
              transformedFilters.push({
                column: columnKey,
                condition: mapAgGridConditionToCustom(filter.condition2.type),
                value: filter.condition2.filter,
              });
            }
          }
        }
      });
    }

    updateParentFormData(transformedFilters, singleFieldData);
  }, []);

  const onFilterModified = useCallback((e: FilterModifiedEvent) => {
    // console.log("onFilterModified", e);
    // console.log("filterInstance.getModel() =>", e.filterInstance.getModel());
    // console.log(
    //   "filterInstance.getModelFromUi() =>",
    //   (e.filterInstance as unknown as IProvidedFilter).getModelFromUi(),
    // );
  }, []);

  const [deriveColumnConfig, setDeriveColumnConfig] = useState<any>(null);

  const getAiTableContext = useCallback(() => {
    if (!columns?.length || !rowData?.length) {
      return { schema: [], data: [] };
    }
    const sampleRow = rowData[0] as Record<string, unknown>;
    const detectType = (value: unknown): string => {
      if (value === null || value === undefined) return "Utf8";
      if (typeof value === "number") {
        return Number.isInteger(value) ? "Int64" : "Float64";
      }
      if (typeof value === "boolean") return "Boolean";
      return "Utf8";
    };
    const columnList = Array.isArray(columns)
      ? columns
      : Object.keys(sampleRow);
    return {
      schema: columnList.map((column: string) => ({
        column,
        type: detectType(sampleRow[column]),
        description: "",
      })),
      data: [sampleRow],
    };
  }, [columns, rowData]);

  const handleSaveDeriveColumn = useCallback(async () => {
    const config = deriveColumnConfig;
    // Allow saving if:
    // 1. target_column is selected, OR
    // 2. operations have been added, OR
    // 3. custom columns (generated_columns) have been added
    const hasTargetColumn = config?.source?.target_column;
    const hasOperations = config?.source?.operations?.length > 0;
    const hasCustomColumns = config?.source?.generated_columns?.length > 0;

    if (config && config.source && (hasTargetColumn || hasOperations || hasCustomColumns)) {
      try {
        await onClickSave("derive_column", config, sourceId);
        toast.success("Derive column saved successfully");
        setIsDeriveColumn(false);
        // Don't clear previewDeriveData or deriveColumnConfig - preserve them
        // The filters are now saved and will be retrieved from the store/API
        setEditingFilterData(null); // Clear editing data only
      } catch (error) {
        console.error("Failed to save derive column:", error);
        toast.error("Failed to save derive column");
      }
    } else {
      toast.warning(
        "Please configure before saving: select a column, add operations, or add a custom column with a required column value"
      );
    }
  }, [deriveColumnConfig, onClickSave, sourceId]);

  const handleSaveCustomColumn = async (filterType: string, data: any) => {
    await onClickSave(filterType, data, sourceId);
    setCustomColumn(false);
  };

  const handleSaveConditionColumn = async (filterData: any) => {
    await onClickSave("conditional_column", filterData, sourceId);
    setCondFilter(false);
  };
  const handleSaveFilterOperations = async () => {
    // Get the current config from the FilterOperations component
    const filterOpsConfig = filterOperationsRef.current?.getCurrentConfig();

    if (!filterOpsConfig) {
      toast.info("Please select an operation type and configure before saving");
      return;
    }

    // Close the modal before saving
    setShowFilterOperations(false);

    try {
      // The config already contains the derive_column or data_filter structure
      // plus the ai_predicate if accepted. Just pass it through with the appropriate filter type.

      // Determine filter type based on what's in the config
      let filterType = "filter_operations";
      if (filterOpsConfig.source) {
        // Has source property - it's from DeriveColumn or DataFilters
        filterType = filterOpsConfig.source.operations ? "derive_column" : "filter";
      }

      // Add ai_predicate to the config if it exists
      const configWithAi = {
        ...filterOpsConfig,
        filter_type: "filter_operations"
      };

      await onClickSave(filterType, configWithAi, sourceId);
      toast.success("Filter operations saved successfully");
    } catch (error) {
      console.error("Failed to save filter operations:", error);
      if (!(error instanceof ApiRequestError)) {
        toast.error(getDisplayErrorMessage(error, "Failed to save filter operations"));
      }
    }
  };

  const handleSaveDataFilters = () => {
    // Get the current config from the DataFilters component
    const filterData = dataFiltersRef.current?.getCurrentConfig();
    // console.log("Data Filters JSON:", filterData);

    if (!filterData) {
      toast.info("Please configure data filters before saving");
      return;
    }

    // Transform the derive column format to filter format (same as AG Grid filter format)
    const transformToFilterFormat = (data: any) => {
      if (!data?.source?.operations || data.source.operations.length === 0) {
        return [];
      }

      const columnType = data.source.target_column_type;

      return data.source.operations.map((operation: any) => {
        let value = operation.parameters?.value;
        if (value === undefined || value === null) {
          value = operation.parameters?.values;
        }

        if (columnType === 'number') {
          if (value === undefined || value === null || value === '') {
            value = 0;
          } else {
            const parsedValue = parseFloat(String(value));
            value = isNaN(parsedValue) ? 0 : parsedValue;
          }
        } else {
          if (value === undefined || value === null) {
            value = '';
          }
        }

        // Preserve the original ID when editing, or use the operation ID for new filters
        const filterId = editingFilterData ? editingFilterData.id : (data.id || operation.id);

        return {
          id: filterId,
          value: value,
          column: data.source.target_column || "",
          condition: operation.operation_name || "",
          new_column: "",
          filter_type: "data_filters",
          set_custom_column: [],
          custom_derived_columns: data
        };
      });
    };

    const newFilters = transformToFilterFormat(filterData);
    // console.log("Transformed Filters:", newFilters);

    if (newFilters.length === 0) {
      toast.info("Please configure at least one filter operation");
      return;
    }

    // For editing: pass ONLY the single modified filter wrapped in the expected format
    // For new: pass ONLY the new filter(s) wrapped in the expected format
    // This matches how derive_column works - it only passes the single filter being added/edited
    const filterToSave = newFilters[0]; // Should only be one operation for data filters

    const dataForSave = [{
      filters: [filterToSave]
    }];

    // Close the modal and reset editing state BEFORE calling onClickSave
    // to avoid state conflicts
    setDataFilters(false);
    const currentEditingData = editingFilterData; // Store before clearing
    setEditingFilterData(null);
    setPreviewDeriveData(null);

    // Call onClickSave with just the single filter
    // Pass sourceId to ensure filters are saved per-source
    onClickSave("filter", dataForSave, sourceId);

    // Update local state for immediate UI feedback
    const existingFilters = data[0]?.filters || [];
    let updatedFilters;

    if (currentEditingData) {
      // Update existing filter in local state
      updatedFilters = existingFilters.map((filter: any) => {
        if (filter.id === currentEditingData.id) {
          return {
            ...filterToSave,
            id: currentEditingData.id
          };
        }
        return filter;
      });
      toast.success("Filter updated successfully");
    } else {
      // Add new filter to local state
      updatedFilters = [...existingFilters, filterToSave];
      toast.success("Filter added successfully");
    }

    const updatedData = [{
      ...(data[0] || {}),
      filters: updatedFilters
    }];

    // Update the form state for display
    onFormChange(updatedData);
  };

  useEffect(() => {
    setInitialData(selectedNode?.data?.node?.payload?.filter_conditions);
    // console.log("Initial Data:", initialData);
  }, [nodes]);

  const handleExecute = async (item: ExecuteItem, allItems?: ExecuteItem[]): Promise<boolean> => {
    try {
      if (!selectedNode) {
        return false;
      }

      if (!item.code?.trim()) {
        return false;
      }

      const nodes = useFlowStore.getState().currentWorkflow?.data?.nodes;
      const setResult = useExecutionResultStore.getState().setResult;

      // Identify all preceding filters including the current one
      // Use allItems passed from CodeEditor if available, otherwise fallback to initialData
      const itemsToProcess = allItems || initialData || [];

      // Find the index of the current item
      const currentIndex = itemsToProcess.findIndex(i => i.id === item.id);

      let filterConditionsToExecute = [];

      if (currentIndex !== -1) {
        // Take all filters up to and including the current one
        filterConditionsToExecute = itemsToProcess.slice(0, currentIndex + 1).map((f, idx) => ({
          id: f.id,
          index: idx,
          filter: f.id === item.id ? item.code : (f.filter || f.code || ""),
          filter_type: f.filter_type,
          sourceId: f.sourceId || sourceId,
          ...(activeRuleName && { rule: activeRuleName }),
          user_request: f.user_request,
        }));
      } else {
        // Fallback to just the single filter if not found in the list
        filterConditionsToExecute = [{
          id: item.id,
          index: 0,
          filter: item.code,
          filter_type: item.filter_type,
          sourceId: item.sourceId || sourceId,
          ...(activeRuleName && { rule: activeRuleName }),
          user_request: item.user_request,
        }];
      }

      console.log(`🚀 Executing ${filterConditionsToExecute.length} filters (up to item ${item.id})`);

      // CRITICAL: Always use raw data from upstream node for every filter execution
      // Do NOT use current node output as it might be partially filtered
      const output = sourceNodes?.[0]?.data?.node?.output;
      const rawData = output?.data;
      let selectedData: any[] = [];
      if (rawData && typeof rawData === 'object' && !Array.isArray(rawData)) {
        const key = selectedSourceKey && (rawData as Record<string, any>).hasOwnProperty(selectedSourceKey) ? selectedSourceKey : Object.keys(rawData as Record<string, any>)[0];
        selectedData = key ? ((rawData as Record<string, any>)[key] || []) : [];
      } else {
        selectedData = Array.isArray(rawData) ? rawData : rowData?.length > 0 ? rowData : [];
      }
      const dataframe = JSON.stringify(selectedData);

      // Prepare a payload that contains all preceding filters
      let payload = {
        key: "on-submit",
        records: {},
        stmtDate: new Date().toISOString().split('T')[0],
        is_pandas: false,
        is_polars: true,
        data_fields: [
          {
            key: "dataframe",
            type: "node-input",
            required: true,
            display_name: "Input Datasets"
          }
        ],
        ...(selectedNode?.data?.node?.payload || {}),
        filter_conditions: filterConditionsToExecute,
        dataframe: dataframe,
        response_type: "json",
        node_id: selectedNode?.id,
        flow_id: useFlowStore.getState().currentWorkflow?.flow_id,
        actions: "filter_executor", // Ensure actions is set to filter_executor
      };

      const response = await saveNodeDetailsApi(
        selectedNode?.data?.node?.execute_node,
        { payload: payload }
      );

      const flowId = useFlowStore.getState().currentWorkflow?.flow_id;
      const nodeOutput = await hydrateNodeOutputAfterExecution(
        flowId,
        selectedNode?.id,
        response
      );

      selectedNode.data.node["output"] = nodeOutput;

      useFlowStore.getState().updateNodeData(selectedNode?.id, selectedNode?.data);

      if (response?.status) {
        setResult({
          id: selectedNode?.id,
          columns: nodeOutput?.columns,
          data: nodeOutput?.data,
          execution_time: response?.execution_time,
          message: response?.message,
          status: response?.status,
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error("Filter execution error:", error);
      return false;
    }
  };

  const handleExecuteAll = async () => {
    return;
  };

  const handleEdit = (indexOrId: number | string) => {
    // Find the filter by ID (preferred) or by index (fallback)
    let filterData;

    if (typeof indexOrId === 'string') {
      // ID was passed - find filter by ID
      filterData = selectedNode?.data?.node?.payload?.filters?.find((f: any) => f.id === indexOrId);
    } else {
      // Index was passed - use it directly (legacy support)
      filterData = selectedNode?.data?.node?.payload?.filters?.[indexOrId];
    }

    if (filterData) {
      setEditingFilterData(filterData);

      // Determine filter type - check both filter_type property and data structure
      let filterType = filterData.filter_type;

      // If filter_type is missing or potentially incorrect, infer it from the data structure
      if (!filterType) {
        // No filter_type set - infer from structure
        if (filterData.conditional_filter_columns && Array.isArray(filterData.conditional_filter_columns) && filterData.conditional_filter_columns.length > 0) {
          filterType = "conditional_column";
        } else if (filterData.set_custom_column && Array.isArray(filterData.set_custom_column) && filterData.set_custom_column.length > 0) {
          filterType = "custom_column";
        } else if (filterData.custom_derived_columns && Object.keys(filterData.custom_derived_columns).length > 0) {
          filterType = "derive_column";
        } else {
          filterType = "filter"; // Default to simple filter
        }
      } else if (filterType === "filter" || filterType === "data_filters") {
        // Filter type is set to "filter" or "data_filters" - but check if it's actually a more specific type
        if (filterData.conditional_filter_columns && Array.isArray(filterData.conditional_filter_columns) && filterData.conditional_filter_columns.length > 0) {
          filterType = "conditional_column";
        } else if (filterData.custom_derived_columns && Object.keys(filterData.custom_derived_columns).length > 0) {
          // Check if it's actually a derive column or data filter
          if (filterData.custom_derived_columns.source) {
            // Has a source property - could be derive_column or data_filters
            // Data filters also have source, so keep it as is
            filterType = filterData.filter_type; // Keep original
          }
        }
      }

      if (filterType === "derive_column") {
        setIsDeriveColumn(true);
        setPreviewDeriveData(filterData);
      } else if (filterType === "custom_column") {
        setCustomColumn(true);
        setPreviewDeriveData(filterData);
      } else if (filterType === "conditional_column") {
        setCondFilter(true);
        // The filterData should already contain conditional_filter_columns
        // Pass it directly if it exists, otherwise wrap it
        if (filterData.conditional_filter_columns && Array.isArray(filterData.conditional_filter_columns)) {
          setPreviewDeriveData(filterData);
        } else {
          // Fallback: if the structure is unexpected, wrap it
          setPreviewDeriveData({
            id: filterData.id,
            conditional_filter_columns: filterData
          });
        }
      } else if (filterType === "filter" || filterType === "data_filters") {
        // Handle both "filter" (simple data filters) and "data_filters" types
        setDataFilters(true);
        // Transform simple filter back to derive column format for editing
        if (filterData.custom_derived_columns && Object.keys(filterData.custom_derived_columns).length > 0) {
          // If custom_derived_columns exists, wrap it properly for DeriveColumn
          setPreviewDeriveData({
            id: filterData.id,
            custom_derived_columns: filterData.custom_derived_columns
          });
        } else if (filterData.column && filterData.condition) {
          // Convert simple filter structure to derive column format
          const deriveFormat = {
            id: filterData.id,
            custom_derived_columns: {
              id: filterData.id,
              name: "Data Filter Configuration",
              source: {
                target_column: filterData.column,
                operations: [{
                  id: filterData.id,
                  operation_name: filterData.condition,
                  parameters: {
                    value: filterData.value,
                  },
                  output_target: {
                    mode: "filter"
                  }
                }],
                generated_columns: []
              }
            }
          };
          setPreviewDeriveData(deriveFormat);
        } else {
          setPreviewDeriveData(filterData);
        }
      }
    }
  };

  const getNodeType = (nodeType: string) => {
    // console.log("Node Type:", nodeType);
    // Allow CodeEditor to show for Filter nodes or filter_data node_id
    return nodeType === "Filter" || nodeType === "filter_data";
  };

  return (
    <div className="space-y-2">
      {isDataEnrichmentFlatMulti && sortedSingleFields.length > 0 && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addRow}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
          <div className="space-y-4">
            {rows.map((rowId) => (
              <div
                key={`data-enrichment-row-${rowId}`}
                className="space-y-3 rounded-lg border border-border bg-muted/20 p-3"
              >
                <div className="border-b border-border/60 pb-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Configuration {rowId + 1}
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {sortedSingleFields.map((field) => {
                    const rowSlice =
                      (typeof data[rowId] === "object" && data[rowId]
                        ? (data[rowId] as Record<string, FormValue>)
                        : {}) ?? {};
                    const allFormValues = {
                      ...rowSlice,
                      ...(formData[rowId] || {}),
                    } as FormSubmissionData;
                    return (
                      <DynamicFieldRenderer
                        key={`${rowId}-${field.key}`}
                        field={{
                          ...field,
                          originalKey: field.key,
                          key: `${field.key}_row_${rowId}`,
                        }}
                        value={getFieldValue(rowId, field.key)}
                        onChange={(_, value) =>
                          handleFieldChange(rowId, field.key, value)
                        }
                        allFormValues={allFormValues}
                        compact
                      />
                    );
                  })}
                </div>
                {(rows.length > 1 || perRowDataPreview?.enabled) && (
                  <div
                    className={`flex flex-wrap items-center gap-2 border-border pt-2 ${rows.length > 1 && perRowDataPreview?.enabled
                      ? "justify-between"
                      : "justify-end"
                      }`}
                  >
                    {rows.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => removeRow(rowId)}
                      >
                        <X className="mr-1 h-4 w-4" />
                        Remove
                      </Button>
                    )}
                    {perRowDataPreview?.enabled && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={perRowDataPreview.disabled}
                        className="gap-1.5 border-primary/25 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent shadow-sm hover:from-primary/15"
                        onClick={() => void perRowDataPreview.onPreviewRow(rowId)}
                      >
                        <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
                        Data preview
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!shouldHideGrid && (
        <div className="sticky top-0 z-20 flex w-full shrink-0 border-b border-border bg-background pb-2 pt-0.5 h-[300px]">
          <div className="ag-grid-theme-sync flex-1 min-w-0">
            <AgGridReact
              key={`filter-node-preview-${appTheme}`}
              theme={agTheme}
              gridOptions={{ suppressFieldDotNotation: true }}
              rowData={rowData || []}
              defaultColDef={{
                editable: false,
                cellRenderer: SmartCellRenderer,
              }}
              columnDefs={colDefs}
              pagination={true}
              onFilterChanged={onFilterChanged}
              onFilterModified={onFilterModified}
              enableCellTextSelection={true}
              ensureDomOrder={true}
            // paginationPageSize={10}
            // paginationAutoPageSize={true}
            // paginationPageSizeSelector={true}
            />
          </div>
          <div className=" mx-1"></div>
          <div ref={sidebarOptionsRef} className="flex w-64 shrink-0 flex-col gap-2">
            {sourceNames.length > 0 && (
              <div className="space-y-1.5 mt-0">
                <label className="text-sm font-semibold">Source</label>
                <Combobox
                  options={sourceNames.map((name) => ({ value: name, label: name }))}
                  value={selectedSourceKey ?? ""}
                  onChange={(val) => setSelectedSourceKey(val != null && val !== "" ? String(val) : null)}
                  placeholder="Select source..."
                  searchPlaceholder="Search sources..."
                  emptyText="No source found."
                  className="!h-8 text-xs w-64"
                  ignoreCloseRef={sidebarOptionsRef}
                />
              </div>
            )}
            <Command className="w-64 shrink-0 overflow-hidden border shadow-md">
              <CommandInput placeholder="Type a command or search..." />
              <CommandList className="max-h-[220px] overflow-y-auto">
                <CommandEmpty>No results found.</CommandEmpty>
                <CommandGroup heading="Options">
                  {/* <CommandItem onSelect={() => onClickSave("filter")}>
                  <FilterIcon />
                  <span>Filter</span>
                </CommandItem> */}
                  <CommandItem onSelect={() => { setIsDeriveColumn(true); setPreviewDeriveData({}); }}>
                    <BetweenVerticalEnd />
                    <span>Derive Column</span>
                  </CommandItem>
                  {/* <CommandItem onSelect={() => setIsFilter(true)}> <FunnelPlus /> <span>Custom Filter</span></CommandItem> */}
                  <CommandItem onSelect={() => { setCustomColumn(true); setPreviewDeriveData({}); }}>
                    <ColumnsSettings />
                    <span>Set Custom Column</span>
                  </CommandItem>
                  <CommandItem onSelect={() => setCondFilter(true)}>
                    <FunnelPlus />
                    <span>Conditional Filters</span>
                  </CommandItem>
                  <CommandItem onSelect={() => { setDataFilters(true); setPreviewDeriveData({}); }}>
                    <FilterIcon />
                    <span>Data Filters</span>
                  </CommandItem>
                  {/* <CommandItem onSelect={() => setShowFilterOperations(true)}>
                  <FunnelPlus />
                  <span>Filter Operations</span>
                </CommandItem> */}
                  {connections.length > 0 && (
                    <CommandItem onSelect={() => setShowColumnFilters(true)}>
                      <Columns3 />
                      <span>Column Filters</span>
                    </CommandItem>
                  )}
                  {/* <CommandItem> <BetweenHorizontalStart /> <span>Set As Headers</span></CommandItem> */}
                  {/* <CommandItem> <Combine /> <span>Extract Data</span></CommandItem> */}
                  {/* <CommandItem> <FileAxis3D /> <span>Extract From File</span></CommandItem> */}
                </CommandGroup>
              </CommandList>
            </Command>
          </div>
        </div>
      )}

      {/* Filter */}
      {!shouldHideGrid && (
        <BaseModal open={isFilter} setOpen={setIsFilter}>
          <BaseModal.Content>
            <FilterCreation />
          </BaseModal.Content>
        </BaseModal>
      )}

      {/* Derive Column */}
      {!shouldHideGrid && (
        <BaseModal
          size="x-large"
          open={isDeriveColumn}
          setOpen={(open) => {
            setIsDeriveColumn(open);
            // Don't clear deriveColumnConfig when closing - preserve it for next time
            // Only clear previewDeriveData if we're closing without saving
            if (!open && !deriveColumnConfig) {
              // Only clear if there's no config to preserve
              setPreviewDeriveData(null);
            }
          }}
          className="p-3 gap-2"
        >
          <BaseModal.Header>
            <span className="text-md font-bold text-foreground mb-2">
              String Operations
            </span>
          </BaseModal.Header>
          <BaseModal.Content>
            <DeriveColumn
              previewDeriveData={
                previewDeriveData?.custom_derived_columns
                  ? previewDeriveData
                  : {}
              }
              selectedSourceKey={selectedSourceKey}
              onClickSave={(config) => setDeriveColumnConfig(config)}
              showAiPanel={showAiPanel}
              onAiButtonClick={() => setShowAiPanel(!showAiPanel)}
              onAiAccept={() => setShowAiPanel(false)}
              onAiDiscard={() => setShowAiPanel(false)}
              prepareAiContext={getAiTableContext}
            />
          </BaseModal.Content>
          <BaseModal.Footer>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsDeriveColumn(false);
                  // Don't clear deriveColumnConfig - preserve it
                  // Don't clear previewDeriveData either - preserve it for editing
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={handleSaveDeriveColumn}
              >
                Save
              </Button>
            </div>
          </BaseModal.Footer>
        </BaseModal>
      )}

      {/* Set Custom Columns */}
      {!shouldHideGrid && (
        <BaseModal
          size="x-large"
          open={customColumn}
          setOpen={setCustomColumn}
          className="p-3 gap-2"
        >
          <BaseModal.Header>
            <span className="text-md font-bold text-foreground !pl-5">Set Custom Columns</span>
          </BaseModal.Header>
          <BaseModal.Content className="flex flex-col gap-3 max-h-[calc(90vh-8rem)] overflow-hidden p-3">
            <ModalSourceDataPreview
              colDefs={colDefs}
              rowData={rowData}
              agTheme={agTheme}
              themeKey={appTheme}
            />
            <div className="flex-1 min-h-0 overflow-y-auto">
              <SetCustomColumn
                onClickSave={(filterType, data) =>
                  handleSaveCustomColumn(filterType, data)
                }
                previewDeriveData={
                  previewDeriveData?.set_custom_column ? previewDeriveData : {}
                }
              />
            </div>
          </BaseModal.Content>
        </BaseModal>
      )}

      {!shouldHideGrid && (
        <BaseModal size="x-large" open={condFilter} setOpen={setCondFilter}>
          <BaseModal.Header>
            <span>Conditional Filters</span>
          </BaseModal.Header>
          <BaseModal.Content>
            <ConditionalFilter
              onClickSave={(filterType) =>
                handleSaveConditionColumn(filterType)
              }
              editPreviewData={
                previewDeriveData?.conditional_filter_columns
                  ? previewDeriveData
                  : {}
              }
            />
          </BaseModal.Content>
        </BaseModal>
      )}

      {!shouldHideGrid && (
        <BaseModal size="x-large" open={dataFilters} setOpen={setDataFilters}>
          <BaseModal.Header>
            <span className="text-md font-bold text-foreground mb-2">
              Data Filters
            </span>
          </BaseModal.Header>
          <BaseModal.Content>
            <DataFilters
              ref={dataFiltersRef}
              onClickSave={() => { }}
              previewData={previewDeriveData || {}}
            />
          </BaseModal.Content>
          <BaseModal.Footer>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setDataFilters(false);
                  setEditingFilterData(null);
                  setPreviewDeriveData(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={handleSaveDataFilters}
              >
                Save
              </Button>
            </div>
          </BaseModal.Footer>
        </BaseModal>
      )}

      {/* Filter Operations - New Feature */}
      {!shouldHideGrid && (
        <BaseModal size="x-large" open={showFilterOperations} setOpen={setShowFilterOperations} className="p-3 gap-2">
          <BaseModal.Header>
            <div className="flex items-center gap-3">
              <span className="text-md font-bold text-foreground">
                Filter Operations
              </span>
              <Select
                value={filterOperationType}
                onValueChange={(value) => {
                  const newValue = value as 'derive_column' | 'data_filter' | '';
                  setFilterOperationType(newValue);
                  filterOperationsRef.current?.setOperationType(newValue || null);
                }}
              >
                <SelectTrigger className="w-[180px] h-8 text-xs">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="derive_column">Derived Column</SelectItem>
                  <SelectItem value="data_filter">Data Filter</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={() => setShowAiPanel(!showAiPanel)}
                size="icon"
                variant="outline"
                className="h-7 w-7 text-primary border-primary/30 hover:bg-primary/10 shadow-sm"
                title="AI Assist"
              >
                <img src={AiIcon} alt="AI" className="w-5 h-5" />
              </Button>
            </div>
          </BaseModal.Header>
          <BaseModal.Content>
            <FilterOperations
              ref={filterOperationsRef}
              previewData={{
                columns: columns,
                sampleData: rowData
              }}
              showAiPanel={showAiPanel}
              onAiPanelClose={() => setShowAiPanel(false)}
              existingFilters={initialData || []}
              onConfigChange={async (aiFilter) => {
                // When AI filter is applied
                if (aiFilter && aiFilter.filter_type === 'ai_generated') {
                  try {
                    // Get the selected node
                    const selectedNode = useFlowStore.getState().getSelectedNode();
                    if (!selectedNode) {
                      toast.error('No node selected');
                      return;
                    }

                    const currentPayload = selectedNode.data?.node?.payload || {};
                    const existingFilterConditions = currentPayload.filter_conditions || [];

                    // Create new filter condition with AI-generated content
                    const newFilterCondition = {
                      id: aiFilter.id,
                      index: aiFilter.index,
                      filter: aiFilter.filter,
                      filter_type: 'ai_generated',
                      sourceId: sourceId,
                      user_request: aiFilter.user_request,
                    };

                    // Add to filter_conditions
                    const updatedFilterConditions = [...existingFilterConditions, newFilterCondition];

                    // Update node payload
                    const updatedNodeData = {
                      ...selectedNode.data,
                      node: {
                        ...selectedNode.data.node,
                        payload: {
                          ...currentPayload,
                          filter_conditions: updatedFilterConditions
                        }
                      }
                    };

                    // Update FlowStore
                    useFlowStore.getState().updateNodeData(selectedNode.id, updatedNodeData);

                    // Save to backend
                    await onClickSave('filter', undefined, sourceId);

                    // Show success message
                    toast.success('AI-generated filter added successfully');
                  } catch (error) {
                    console.error('Error adding AI filter:', error);
                    // toast.error('Failed to add AI filter');
                  } finally {
                    // Always close modals
                    setShowFilterOperations(false);
                    setShowAiPanel(false);
                  }
                }
              }}
            />
          </BaseModal.Content>
          <BaseModal.Footer>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowFilterOperations(false);
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={handleSaveFilterOperations}
              >
                Save
              </Button>
            </div>
          </BaseModal.Footer>
        </BaseModal>
      )}

      {/* Column Filters - Shows FiltersPageView */}
      {!shouldHideGrid && connections.length > 0 && (
        <BaseModal size="x-large" open={showColumnFilters} setOpen={setShowColumnFilters} className="p-0">
          <BaseModal.Content className="p-0 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex-1 overflow-hidden">
              <FiltersPageView
                onBack={() => setShowColumnFilters(false)}
                onClose={() => setShowColumnFilters(false)}
                connections={connections}
                selectedColumnForFilter={selectedColumnForFilter}
                onColumnSelect={(column) => {
                  setSelectedColumnForFilter(column);
                  onColumnSelect(column);
                }}
                onFiltersChange={onFiltersChange}
                dataSources={dataSources}
                connectionKeyStates={connectionKeyStates}
                getConnectionKeyState={getConnectionKeyState}
                sourceName={sourceId ? dataSources.find(ds => ds.id === sourceId)?.name : undefined}
                storedColumnFilters={useValidationStore.getState().columnFiltersBySource}
                onFilterSave={async (filterType?: string, data?: any, sourceIdParam?: string) => {
                  const finalSourceId = sourceIdParam || sourceId;
                  await onClickSave(filterType, data, finalSourceId);
                }}
                sourcesToShow={dataSources} // Use dataSources as sourcesToShow for per-source tabs
                selectedSourceTab={sourceId}
                onSourceTabChange={(newSourceId) => {
                  // If sourceId changes, we could update it, but since we're in a modal,
                  // we'll just use the new sourceId for filter operations
                }}
              />
            </div>
          </BaseModal.Content>
        </BaseModal>
      )}

      {/* Multi-row filters section */}
      {/* For Filter Code Editor */}
      {sortedFilterFields.length > 0 && (
        <div className="space-y-1">
          <div className="flex flex-wrap items-end justify-end gap-2 border-b border-border bg-background py-2">
            {!shouldHideGrid && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onClickSave()}
                className="mr-5 flex items-center gap-2"
              >
                {/* <Plus className="w-4 h-4" /> */}
                Create
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addRow}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add
            </Button>
          </div>

          <div
            className={cn(
              "max-h-[min(50vh,520px)] overflow-y-auto overflow-x-hidden rounded-md border border-border/70 bg-muted/10 py-1 pl-1 pr-2",
              shouldHideGrid ? "min-h-[320px]" : "min-h-[150px]"
            )}
            role="region"
            aria-label="Filter conditions"
          >
            <div className="space-y-2">
              {rows.map((rowId) => (
                <div
                  key={`row-${rowId}`}
                  className="mb-2 flex w-full items-start space-x-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                      {sortedFilterFields.map((field) => {
                        const uniqueFieldForRenderer = {
                          ...field,
                          key: `${field.key}_row_${rowId}`,
                        };

                        return (
                          <DynamicFieldRenderer
                            key={`${rowId}-${field.key}`}
                            field={uniqueFieldForRenderer}
                            value={getFieldValue(rowId, field.key)}
                            onChange={(_, value) => {
                              handleFieldChange(rowId, field.key, value);
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                  {/* Remove Button Section */}
                  {rows.length > 1 && (
                    <div className="shrink-0 pt-[1.18rem]">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeRow(rowId)}
                        className="text-red-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Single fields section */}
      {/* Always show CodeEditor if we have filter conditions, regardless of node type */}
      {/* Show CodeEditor for Filter nodes, filter_data node_id, or when we have initialData (including derive column filters) */}
      {(getNodeType(
        selectedNode?.data?.type || selectedNode?.data?.node?.type || selectedNode?.data?.node_id
      ) || sourceId != null) && selectedNode?.data?.node_id !== "data_enrichment" && (<CodeEditor
        key={`code-editor-${sourceId || 'default'}-${sourceId || 'default'}`}
        sourceId={sourceId}
        selectedSourceKey={selectedSourceKey}
        activeRuleId={activeRuleId}
        activeRuleName={activeRuleName}
        initialData={
          // Filter initialData by sourceId to ensure only filters for current source are shown
          // Use stored state if available to preserve filters when switching tabs
          (() => {
            const storedState = sourceId ? filterStateBySourceRef.current[sourceId] : null;
            const dataToUse = storedState?.initialData || initialData;

            if (Array.isArray(dataToUse) && dataToUse.length > 0) {
              return dataToUse.filter(item => {
                // If sourceId is provided, only show filters that match this sourceId
                if (sourceId && item && typeof item === 'object') {
                  const itemSourceId = item.sourceId;
                  // Only include filters that have matching sourceId
                  return itemSourceId === sourceId;
                }
                // If no sourceId, show all (for backward compatibility)
                return true;
              });
            }

            // If no initialData but we have systemFilters, convert them to CodeEditor format
            if (Array.isArray(systemFilters) && systemFilters.length > 0) {
              return systemFilters
                .filter((filter: any) => {
                  // Filter by sourceId if provided
                  if (sourceId && filter && typeof filter === 'object' && filter.sourceId !== undefined) {
                    return filter.sourceId === sourceId;
                  }
                  return true;
                })
                .map((filter: any) => {
                  // Convert to CodeEditor format
                  if (typeof filter === 'object' && filter.filter !== undefined) {
                    return {
                      id: filter.id || `filter-${Date.now()}`,
                      filter: filter.filter,
                      filter_type: filter.filter_type || 'auto',
                      index: filter.index !== undefined ? filter.index : 0,
                      sourceId: filter.sourceId || sourceId,
                    };
                  }
                  return {
                    id: `filter-${Date.now()}`,
                    filter: typeof filter === 'string' ? filter : JSON.stringify(filter),
                    filter_type: 'auto',
                    index: 0,
                    sourceId: sourceId,
                  };
                });
            }

            return [];
          })()
        }
        onExecute={(item) => handleExecute(item)}
        onExecuteAll={handleExecuteAll}
        onTriggerEdit={handleEdit}
      />
        )}
    </div>
  );
};

export default MultiRowDynamicForm;
