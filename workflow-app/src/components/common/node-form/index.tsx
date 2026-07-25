import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import cloneDeep from "lodash/cloneDeep";
import api from "@/controllers/API/api";
import { compressPayloadData } from "@/utils/compressionUtils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, CheckCircle2 } from "lucide-react";
import DynamicFieldRenderer from "../dynamic-field-render";
import MultiRowDynamicForm from "../multi-row-dynamic-field";
import { createFileDatasetApi, saveNodeDetailsApi, saveWorkflow } from "@/controllers/API";
import { toast } from "sonner";
import { FieldTemplate, FormSubmissionData } from "@/types/form";
import {
  checkFieldDependencies,
  checkFieldDependenciesForApiConnector,
} from "@/utils/formDependencyUtils";
import { useParams } from "react-router-dom";
import { useFormStore } from "@/stores/formStore";
import { useFlowsManagerStore } from "@/stores/flowManagerStore";
import { useSaveWorkflow } from "@/hooks/use-save-flow";
import useFlowStore from "@/stores/flowStore";
import enrichColumnsFormData from "../enrichColumns/enrichFormData.json";
import EnrichColumns from "../enrichColumns";
import { getNodeId } from "@/utils/reactflowUtils";
import { isDeduplicationNodeId } from "@/utils/workflowNodeId";
import {
  mapFilterDataToPayload,
  mergeFilterConditionsAfterGeneratorResponse,
} from "@/utils/filterUtils";
import DynamicForm from "../dynamicForm";
import {
  transformRawSchema,
  applyFileSourceTemplatePatch,
  FILE_SOURCE_TEMPLATE_PATCH_NODE_IDS,
  getUpstreamDisplayNameForPayload,
  shouldBuildKeyedDataframeForExcelWrite,
} from "@/utils/transformTemplate";
import {
  applySapNodeTemplatePatch,
  isSapWorkflowNode,
  resolveDatabaseActionsKlass,
} from "@/utils/sapNodeActions";
import { cn } from "@/lib/utils";
import FormDataDisplay from "../formDataDisplay";
import { useTextSelectionStore } from "@/stores/textSelectionStore";
import { useNodeStore } from "@/stores/nodeStore";
import { sanitizeFilters } from "@/utils/utils";
import { useCustomColumnStore } from "@/stores/customColumnStore";
import { FileNodeForm } from "../FileNodeForm/FileNodeForm";
import {
  API_CONNECTOR_KEY_VALUE_MAP_FIELDS,
  apiConnectorMapToKeyValueRows,
  applyApiConnectorFormStateAfterFieldChange,
  sanitizeApiConnectorPayloadForWire,
  serializeApiConnectorKeyValueMapsForApi,
} from "@/utils/apiConnectorPayload";

/**
 * Node catalog group from API (`group` or `group_type`). Case-insensitive for
 * known buckets so e.g. `group_type: "ingestion"` matches ingestion nodes like `api_connector`.
 */
function getWorkflowNodeDataGroup(
  nodeData: { data?: Record<string, unknown> } | null | undefined
): string | undefined {
  const layer = nodeData?.data;
  const raw = layer?.group ?? layer?.group_type;
  if (raw == null || String(raw).trim() === "") return undefined;
  const lower = String(raw).trim().toLowerCase();
  if (lower === "databases") return "Databases";
  if (lower === "files") return "Files";
  if (lower === "ingestion") return "Ingestion";
  return String(raw).trim();
}

/** Turn payload/template tokens like `{{name}}` into empty string so the form looks editable, not raw templates. */
function stripTemplatePlaceholder(val: unknown): unknown {
  if (typeof val === "string") {
    const t = val.trim();
    if (/^{{[\s\S]+}}$/.test(t)) return "";
    return val;
  }
  return val;
}

function coerceTemplateBoolean(val: unknown): boolean {
  if (val === true || val === "true" || val === 1 || val === "1") return true;
  return false;
}

const API_DATA_ENRICHMENT_ACTION = "api_data_enrichment";

function getPayloadDataObject(payload: Record<string, unknown>): Record<string, unknown> {
  const d = payload.data;
  if (d && typeof d === "object" && !Array.isArray(d)) return d as Record<string, unknown>;
  return {};
}

/** Multiple enrichment rows live in `payload.data.rules` (array, or legacy JSON string). */
function readDataEnrichmentRulesList(payload: unknown): Record<string, unknown>[] | null {
  if (!payload || typeof payload !== "object") return null;
  const raw = getPayloadDataObject(payload as Record<string, unknown>).rules;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw as Record<string, unknown>[];
  }
  if (typeof raw === "string") {
    const t = raw.trim();
    if (t === "" || /^{{[\s\S]+}}$/.test(t)) return null;
    try {
      const parsed = JSON.parse(t);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed as Record<string, unknown>[];
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

/** Where Data Preview writes the selected JSON path (per node API `data_preview` config). */
function getDataEnrichmentPathFormKey(nodeLayer: { data?: { node?: unknown } } | null | undefined): string {
  const node = nodeLayer?.data?.node as
    | { data_preview?: { preview_to_main_field_map?: { target_form_key?: string } } }
    | undefined;
  const k = node?.data_preview?.preview_to_main_field_map?.target_form_key;
  return typeof k === "string" && k.trim() ? k.trim() : "response_json_path";
}

/** When `target_form_key` is not `response_json_path`, migrate legacy rules and omit the old key. */
function normalizeDataEnrichmentPathFieldOnRow(row: Record<string, unknown>, pathKey: string) {
  if (pathKey === "response_json_path") return;
  const legacy = row.response_json_path;
  if (legacy !== undefined && legacy !== null && String(legacy).trim() !== "") {
    const cur = row[pathKey];
    if (cur === undefined || cur === null || String(cur).trim() === "") {
      row[pathKey] = legacy;
    }
  }
  delete row.response_json_path;
}

function keyValueFieldIsVisuallyEmpty(val: unknown): boolean {
  if (val === undefined || val === null) return true;
  if (typeof val === "string") {
    const t = val.trim();
    if (t === "") return true;
    try {
      return keyValueFieldIsVisuallyEmpty(JSON.parse(t));
    } catch {
      return false;
    }
  }
  if (Array.isArray(val)) {
    if (val.length === 0) return true;
    return val.every((row) => {
      if (row == null || typeof row !== "object") return true;
      const r = row as { key?: unknown; value?: unknown };
      return (
        String(r.key ?? "").trim() === "" && String(r.value ?? "").trim() === ""
      );
    });
  }
  if (typeof val === "object") {
    return Object.keys(val as Record<string, unknown>).length === 0;
  }
  return false;
}

/** Query params + extra headers: start with one blank row each when empty (API Connector). */
const API_CONNECTOR_SEED_KV_KEYS = new Set(["params", "headers"]);

function seedApiConnectorEmptyKeyValueRows(
  nodeId: string | undefined,
  templateObj: Record<string, FieldTemplate>,
  values: Record<string, unknown>
): Record<string, unknown> {
  if (nodeId !== "api_connector" && nodeId !== "data_enrichment") return values;
  const next = { ...values };
  for (const fieldKey of API_CONNECTOR_SEED_KV_KEYS) {
    const def = templateObj[fieldKey];
    if (
      !def ||
      typeof def !== "object" ||
      (def as FieldTemplate).type !== "key-value"
    ) {
      continue;
    }
    if (!keyValueFieldIsVisuallyEmpty(next[fieldKey])) continue;
    next[fieldKey] = [{ key: "", value: "" }];
  }
  return next;
}

/** API Connector: place Query parameters and Extra headers on one row (two columns). */
type ApiConnectorFieldRow =
  | { kind: "single"; field: FieldTemplate }
  | { kind: "paramsHeadersPair"; params: FieldTemplate; headers: FieldTemplate };

function hydrateApiConnectorKeyValueFieldsForForm(
  nodeId: string | undefined,
  values: Record<string, unknown>
) {
  if (nodeId !== "api_connector" && nodeId !== "data_enrichment") return;
  for (const key of API_CONNECTOR_KEY_VALUE_MAP_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(values, key)) continue;
    values[key] = apiConnectorMapToKeyValueRows(values[key]);
  }
}

function fieldPassesDependencyVisibility(
  nodeId: string | undefined,
  field: FieldTemplate,
  formValues: FormSubmissionData
): boolean {
  if (nodeId === "api_connector" || nodeId === "data_enrichment") {
    return checkFieldDependenciesForApiConnector(field, formValues);
  }
  return checkFieldDependencies(field, formValues);
}

/** Replace `{{field_key}}` strings using merged form + payload lookups (recursive for nested preview config). */
function resolveTemplateParamObject(
  params: unknown,
  lookups: Record<string, unknown>
): unknown {
  if (params === null || params === undefined) return params;
  if (typeof params === "string") {
    const t = params.trim();
    const m = t.match(/^{{\s*([\w]+)\s*}}$/);
    if (m) {
      const key = m[1];
      const val = lookups[key];
      return val === undefined || val === null ? "" : val;
    }
    return params;
  }
  if (Array.isArray(params)) {
    return params.map((item) => resolveTemplateParamObject(item, lookups));
  }
  if (typeof params === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(params as Record<string, unknown>)) {
      out[k] = resolveTemplateParamObject(v, lookups) as unknown;
    }
    return out;
  }
  return params;
}

function attachUpstreamDataframeForPayload(
  payloadToSend: { node?: { payload?: Record<string, unknown> } },
  nodeId: string | undefined,
  sourceNodes: unknown[],
  modeVal: unknown
) {
  const pl = payloadToSend?.node?.payload;
  if (!pl || !Object.prototype.hasOwnProperty.call(pl, "dataframe")) return;
  if (pl.dataframe === false) return;
  const upstream = Array.isArray(sourceNodes) ? sourceNodes : [];
  if (shouldBuildKeyedDataframeForExcelWrite(nodeId, modeVal, upstream.length)) {
    const keyed: Record<string, string> = {};
    for (const sn of upstream) {
      const label = getUpstreamDisplayNameForPayload(sn);
      const df = (sn as { data?: { node?: { output?: { data?: unknown } } } })?.data?.node
        ?.output?.data;
      keyed[label] = JSON.stringify(df ?? []);
    }
    pl.dataframe = keyed;
  } else {
    const dataframe = (upstream[0] as { data?: { node?: { output?: { data?: unknown } } } })
      ?.data?.node?.output?.data;
    pl.dataframe = JSON.stringify(dataframe);
  }
}

function buildApiConnectorFieldRows(fields: FieldTemplate[]): ApiConnectorFieldRow[] {
  const paramsField = fields.find((f) => f.key === "params");
  const headersField = fields.find((f) => f.key === "headers");
  const hasBoth = !!(paramsField && headersField);
  const rows: ApiConnectorFieldRow[] = [];
  let insertedPair = false;

  for (const field of fields) {
    if (field.key === "params" || field.key === "headers") {
      if (hasBoth && !insertedPair) {
        rows.push({
          kind: "paramsHeadersPair",
          params: paramsField!,
          headers: headersField!,
        });
        insertedPair = true;
      } else if (!hasBoth) {
        rows.push({ kind: "single", field });
      }
      continue;
    }
    rows.push({ kind: "single", field });
  }
  return rows;
}

interface NodeFormProps {
  template?: Record<string, FieldTemplate> | null;
  nodeData: any;
  saveApiEndpoint: any;
  onClose: () => void;
  disabled?:boolean;
}

const NodeForm = ({
  template,
  nodeData,
  saveApiEndpoint,
  onClose,
  disabled
}: NodeFormProps) => {
  const dataGroup = useMemo(() => getWorkflowNodeDataGroup(nodeData), [nodeData]);
  const useConnectorFormLayout = nodeData?.data?.node_id === "api_connector";

  const [formData, setFormData] = useState<FormSubmissionData | null>(null);
  const selectedNode = useFlowStore.getState().getSelectedNode();
  const isDataSetNode = selectedNode?.data?.isDataset ?? false
  const cloneFormPayload = useCallback(
    (payload: FormSubmissionData | null | undefined): FormSubmissionData | null => {
      if (payload == null) return null;
      return cloneDeep(payload) as FormSubmissionData;
    },
    [],
  );

  const [editingData, setEditingData] = useState<FormSubmissionData | null>(() =>
    (isDataSetNode || selectedNode?.data?.saved_node)
      ? cloneDeep((selectedNode?.data?.node?.payload ?? selectedNode?.data?.payload) as FormSubmissionData)
      : null,
  );
  const [liveFormData, setLiveFormData] = useState<FormSubmissionData | null>(() =>
    (isDataSetNode || selectedNode?.data?.saved_node)
      ? cloneDeep((selectedNode?.data?.node?.payload ?? selectedNode?.data?.payload) as FormSubmissionData)
      : null,
  );
  const [sourceNodes, setSourceNodes] = useState<any>([]);

  const conditionsKeyMap: { [key: string]: string } = {
    add_column: 'add_conditions',
    rename_column: 'rename_conditions',
    sort_data: 'sort_conditions',
    drop_column: 'drop_conditions',
    filter_data: 'filters',
  };

  const handleFormSubmit = (data: FormSubmissionData) => {
    setFormData(data);
    saveNodeDetails(data);
    // Update editingData with the submitted data to maintain form values after save
    const saved = cloneFormPayload(data);
    setEditingData(saved);
    setLiveFormData(saved);
  };

  const databaseFormSchema = useMemo(() => {
    const nid = nodeData?.data?.node_id;
    const patchedTemplate =
      template && isSapWorkflowNode(nid)
        ? applySapNodeTemplatePatch(template, nid) ?? template
        : template;
    return patchedTemplate
      ? transformRawSchema(
          patchedTemplate,
          'Node Configuration',
          'Node Configuration',
        )
      : null;
  }, [template, nodeData?.data?.node_id]);

  const handleEdit = () => {
    const payload =
      dataGroup === "Databases" || selectedNode?.data?.isDataset
        ? ((selectedNode?.data?.node?.payload ?? selectedNode?.data?.payload) as FormSubmissionData | undefined)
        : (formData ?? undefined);
    const restored = cloneFormPayload(payload);
    setEditingData(restored);
    setLiveFormData(restored);
  };

  // Reload saved payload when switching to another database node.
  // Reload saved payload when switching to another database or files node.
  useEffect(() => {
    if (dataGroup !== "Databases" && dataGroup !== "Files") return;
    const payload = (selectedNode?.data?.node?.payload ?? selectedNode?.data?.payload) as FormSubmissionData | undefined;
    if (payload && (isDataSetNode || selectedNode?.data?.saved_node)) {
      const restored = cloneFormPayload(payload);
      setEditingData(restored);
      setLiveFormData(restored);
      setFormData(restored);
    } else {
      setEditingData(null);
      setLiveFormData(null);
      setFormData(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync only on node switch
  }, [selectedNode?.id, dataGroup, cloneFormPayload, isDataSetNode, selectedNode?.data?.saved_node]);

  const { id } = useParams();
  const { mutate: saveFlow, data, isPending } = useSaveWorkflow();
  const [systemfilters, setSystemFilters] = useState(
    selectedNode?.data?.node?.payload?.filter_conditions || []
  );

  const fileGroupTemplate = useMemo(() => {
    const nid = nodeData?.data?.node_id;
    if (template && nid != null && FILE_SOURCE_TEMPLATE_PATCH_NODE_IDS.has(String(nid))) {
      return applyFileSourceTemplatePatch(template) ?? template;
    }
    return template;
  }, [template, nodeData?.data?.node_id]);

  const initialFormValues = Object.fromEntries(
    fileGroupTemplate
      ? Object.entries(fileGroupTemplate).map(([key, value]) => {
        const v = value.value !== undefined ? value.value : "";
        if (value.type === "checkbox") {
          return [key, coerceTemplateBoolean(v)];
        }
        return [key, v];
      })
      : []
  );

  const getInitialFormValues = () => {
    const templateObj = template && typeof template === 'object' ? template : {};
    const templateKeys = Object.keys(templateObj);
    if (templateKeys.length === 0) return {};

    if (nodeData?.data?.saved_node && !nodeData.data.is_multiple_form) {
      const payload = nodeData?.data?.node?.payload;
      if (payload != null && typeof payload === 'object') {
        const initialValues: Record<string, unknown> = {};
        templateKeys.forEach((fieldKey) => {
          const fieldTemplate = templateObj[fieldKey] as FieldTemplate | undefined;
          let raw: unknown;
          if (Object.prototype.hasOwnProperty.call(payload, fieldKey)) {
            raw = stripTemplatePlaceholder((payload as Record<string, unknown>)[fieldKey]);
          } else {
            raw = stripTemplatePlaceholder(
              fieldTemplate?.value !== undefined ? fieldTemplate.value : ""
            );
          }
          if (fieldTemplate?.type === "checkbox") {
            initialValues[fieldKey] = coerceTemplateBoolean(raw);
          } else {
            initialValues[fieldKey] = raw;
          }
        });
        hydrateApiConnectorKeyValueFieldsForForm(
          nodeData?.data?.node_id,
          initialValues
        );
        return seedApiConnectorEmptyKeyValueRows(
          nodeData?.data?.node_id,
          templateObj as Record<string, FieldTemplate>,
          initialValues
        );
      }
    }
    const fromTemplate = Object.fromEntries(
      templateKeys.map((key) => {
        const ft = templateObj[key] as FieldTemplate | undefined;
        const raw = stripTemplatePlaceholder(
          templateObj[key]?.value !== undefined ? templateObj[key].value : ""
        );
        return [
          key,
          ft?.type === "checkbox" ? coerceTemplateBoolean(raw) : raw,
        ];
      })
    );
    hydrateApiConnectorKeyValueFieldsForForm(nodeData?.data?.node_id, fromTemplate);
    return seedApiConnectorEmptyKeyValueRows(
      nodeData?.data?.node_id,
      templateObj as Record<string, FieldTemplate>,
      fromTemplate
    );
  };

  const getInitialMultiRowData = () => {
    // Check if this is a multi-row form node
    if (nodeData?.data?.is_multiple_form) {
      const payload = nodeData?.data?.node?.payload;
      const nodeId = nodeData.data.node_id;
      const conditionsKey = conditionsKeyMap[nodeId];

      if (nodeId === "data_enrichment") {
        const list = readDataEnrichmentRulesList(payload);
        if (list) {
          const first = list[0];
          if (
            list.length === 1 &&
            first &&
            typeof first === "object" &&
            Object.values(first as Record<string, unknown>).some(
              (val) => typeof val === "string" && /^{{.*}}$/.test(val)
            )
          ) {
            return [{}];
          }
          const pathKey = getDataEnrichmentPathFormKey(nodeData);
          return list.map((row) => {
            const r = { ...row };
            normalizeDataEnrichmentPathFieldOnRow(r, pathKey);
            hydrateApiConnectorKeyValueFieldsForForm("data_enrichment", r);
            return r;
          });
        }
        const tmpl = nodeData?.data?.node?.template as Record<string, unknown> | undefined;
        const p = payload as Record<string, unknown> | undefined;
        if (p && tmpl && typeof tmpl === "object") {
          const row: Record<string, unknown> = {};
          for (const [, v] of Object.entries(tmpl)) {
            if (!v || typeof v !== "object") continue;
            const ft = v as FieldTemplate;
            if (typeof ft.key !== "string" || typeof ft.type !== "string") continue;
            if (Object.prototype.hasOwnProperty.call(p, ft.key)) {
              row[ft.key] = stripTemplatePlaceholder(p[ft.key]);
            }
          }
          if (Object.keys(row).length > 0) {
            hydrateApiConnectorKeyValueFieldsForForm("data_enrichment", row);
            return [row];
          }
        }
        return [{}];
      }

      // If we have a conditions key and payload data exists
      if (conditionsKey && payload && payload[conditionsKey]?.length > 0) {
        const data = payload[conditionsKey];
        const firstItem = data[0];

        // Check if this is template data (contains placeholder values like {{...}})
        // If so, return empty form
        if (data.length === 1 && firstItem && Object.values(firstItem).some(val => typeof val === 'string' && /^{{.*}}$/.test(val))) {
          return [{}];
        }

        // Return actual saved data
        return data;
      }
    }
    return [{}];
  };
  const [formValues, setFormValues] = useState(getInitialFormValues);
  const [multiRowData, setMultiRowData] = useState(getInitialMultiRowData);

  const isFilterDataNode = nodeData?.data?.node_id === 'filter_data';
  const isMultiRowFormNode = nodeData?.data?.is_multiple_form === true;
  const handleChange = (key: string, value: any) => {
    setFormValues((prev) => {
      if (nodeData?.data?.node_id === "api_connector") {
        return applyApiConnectorFormStateAfterFieldChange(prev, key, value);
      }
      return { ...prev, [key]: value };
    });
  };

  const sortedApiConnectorTemplateFields = useMemo((): FieldTemplate[] => {
    if (!useConnectorFormLayout || template == null || typeof template !== "object") {
      return [];
    }
    return (Object.values(template) as FieldTemplate[])
      .filter(
        (f) =>
          f &&
          typeof f === "object" &&
          typeof f.key === "string" &&
          typeof f.type === "string"
      )
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  }, [useConnectorFormLayout, template]);

  const visibleApiConnectorFields = useMemo(
    () =>
      sortedApiConnectorTemplateFields.filter((field) =>
        checkFieldDependenciesForApiConnector(
          field,
          formValues as FormSubmissionData
        )
      ),
    [sortedApiConnectorTemplateFields, formValues]
  );

  const apiConnectorFieldRows = useMemo(
    () => buildApiConnectorFieldRows(visibleApiConnectorFields),
    [visibleApiConnectorFields]
  );

  const handleMultiRowChange = (data: any[]) => {
    setMultiRowData(data);
  };

  const handleSaveConditions = async (filterType?: string, json?: any, sourceId?: string): Promise<void> => {
    if (!filterType) return;

    let filterData: any[] = [];
    if (filterType === "filter") {
      const dataToUse = json || multiRowData;
      if (!dataToUse || dataToUse.length === 0) {
        toast.info("Please filter data to perform filter action");
        return;
      }
      filterData = mapFilterDataToPayload(dataToUse, filterType);
    } else if (filterType === "derive_column") {
      // Allow saving if json exists and has either:
      // 1. A target_column selected, OR
      // 2. Custom columns (generated_columns) added
      const hasTargetColumn = json?.source?.target_column;
      const hasCustomColumns = json?.source?.generated_columns?.length > 0;

      if (!json || (!hasTargetColumn && !hasCustomColumns)) {
        toast.info("Please select a Column or add custom columns to perform derive column action");
        return;
      }
      filterData = mapFilterDataToPayload(
        [{ filters: [{ id: json.id, custom_derived_columns: json }] }],
        filterType
      );
    } else if (filterType === "custom_column") {
      if (!json) {
        toast.info("Please select a transformation to perform custom column action");
        return;
      }
      filterData = mapFilterDataToPayload([{ filters: [json] }], filterType);
    } else if (filterType === "conditional_column") {
      if (!json) {
        toast.info("Please add conditional filters to perform this action");
        return;
      }
      filterData = mapFilterDataToPayload(
        [{ filters: [{ id: json.id, ...json }] }],
        filterType
      );
    }
    try {
      const nodes: any[] = useFlowStore.getState().currentWorkflow?.data?.nodes;
      const previousPayload =
        nodes.find((n: any) => n.id === selectedNode?.id)?.data?.node
          ?.payload || {};
      const payload = {
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
        ...previousPayload,
        ...formValues,
        actions: "filter_generator",
        node_id: selectedNode?.id,
        current_node_id: selectedNode?.id,
        flow_id: selectedNode?.data?.flow_id || useFlowStore.getState().currentWorkflow?.flow_id,
      };

      if (["derive_column", "custom_column", "conditional_column"].includes(filterType)) {
        if (!Array.isArray(previousPayload.filter_conditions) || previousPayload.filter_conditions.length === 0) {
          payload.filter_conditions = [];
        }
      }

      if (isFilterDataNode) {
        const existingFilters = Array.isArray(previousPayload.filters)
          ? previousPayload.filters
          : [];
        const sanitizedExisting = sanitizeFilters(existingFilters);

        const mergedFilters = sanitizedExisting.filter(
          (existing) =>
            !filterData.some(
              (incoming) => incoming.id && incoming.id === existing.id
            )
        );
        payload["filters"] = [...mergedFilters, ...filterData];
      }

      const response = await saveNodeDetailsApi(
        nodeData?.data?.node?.create_query,
        { payload: payload }
      );

      if (response?.data && response?.data?.length > 0) {
        toast.success("Filter generated successfully");

        const mergedFilterConditions = mergeFilterConditionsAfterGeneratorResponse(
          previousPayload.filter_conditions,
          response?.data
        );

        selectedNode.data.node.payload = {
          ...selectedNode.data.node.payload,
          filters: payload["filters"],
          filter_conditions: mergedFilterConditions,
        };

        useFlowStore.getState().updateNodeData(selectedNode.id, selectedNode.data);
        setSystemFilters(mergedFilterConditions);
      }
    } catch (error) {
      console.error("Save failed:", error);
      toast.error("Failed to generate filter");
    }
  };

  const isMultiRowFormNode_check = nodeData?.data?.is_multiple_form === true;
  const saveButtonLabel = template?.save_node?.name || "Save";

  useEffect(() => {
    // Global form store keys are not namespaced by node; clear it when switching nodes so
    // multi-select and other fields do not show the previous node's values.
    useFormStore.getState().resetForm();

    if (nodeData) {
      setFormValues(getInitialFormValues());
      setMultiRowData(getInitialMultiRowData());
    }

    if (selectedNode?.id) {
      const sourceNode = useFlowStore.getState().getUpstreamNodes(selectedNode.id);
      setSourceNodes(sourceNode);
    }
  }, [nodeData?.id, nodeData]);

  const buildPayload = (data?: FormSubmissionData, filterType?: string) => {
    const nodes: any = useFlowStore.getState().currentWorkflow?.data?.nodes;

    const liveSelected = useFlowStore.getState().getSelectedNode();
    const updatedNodeData: any = cloneDeep(liveSelected ?? selectedNode);
    const template = updatedNodeData?.data?.node?.template;
    const payload = updatedNodeData?.data?.node?.payload;
    const nodeId = updatedNodeData?.data?.node_id;

    if (updatedNodeData?.data?.node_id === "filter_data") {
      if (filterType === "custom_column") {
        const filterNode: any = nodes.find((n: any) => n.id === selectedNode?.id);
        updatedNodeData.data.node.payload = filterNode?.data?.node?.payload;
      } else {
        updatedNodeData.data.node.payload.filters = multiRowData;
      }
    } else if (isMultiRowFormNode_check) {
      const conditionsKey = conditionsKeyMap[nodeId];
      if (payload && nodeId === "data_enrichment" && template) {
        const templateObj = template as Record<string, unknown>;
        const p = payload as Record<string, unknown>;
        for (const [, fieldDef] of Object.entries(templateObj)) {
          const fd = fieldDef as FieldTemplate;
          if (fd && typeof fd.key === "string" && typeof fd.type === "string") {
            delete p[fd.key];
          }
        }
        const dataObj = getPayloadDataObject(p);
        const reservedDataKeys = new Set([
          "rules",
          "is_pandas",
          "is_polars",
          "response_type",
        ]);
        for (const [, fieldDef] of Object.entries(templateObj)) {
          const fd = fieldDef as FieldTemplate;
          if (
            fd &&
            typeof fd.key === "string" &&
            typeof fd.type === "string" &&
            !reservedDataKeys.has(fd.key)
          ) {
            delete dataObj[fd.key];
          }
        }

        const rowTemplate: Record<string, unknown> = {};
        for (const [templateKey, fieldDef] of Object.entries(templateObj)) {
          if (templateKey === "save_node" || templateKey === "filters") continue;
          if (
            !fieldDef ||
            typeof fieldDef !== "object" ||
            !("value" in fieldDef) ||
            typeof (fieldDef as FieldTemplate).key !== "string"
          ) {
            continue;
          }
          const fd = fieldDef as FieldTemplate;
          if (typeof fd.value === "string" && fd.value.match(/^{{.*}}$/)) {
            rowTemplate[fd.key] = "";
          } else {
            rowTemplate[fd.key] = fd.value;
          }
        }

        const pathKey = getDataEnrichmentPathFormKey(updatedNodeData);
        const rows = multiRowData.map((formRow) => {
          const row: Record<string, unknown> = {
            ...rowTemplate,
            ...formRow,
          };
          normalizeDataEnrichmentPathFieldOnRow(row, pathKey);
          sanitizeApiConnectorPayloadForWire(row);
          serializeApiConnectorKeyValueMapsForApi(row);
          return row;
        });

        p.data = {
          is_pandas: dataObj.is_pandas === true,
          is_polars: dataObj.is_polars === true,
          response_type:
            typeof dataObj.response_type === "string"
              ? dataObj.response_type
              : "json",
          rules: rows,
        };
        if (!p.actions || String(p.actions).trim() === "") {
          p.actions = API_DATA_ENRICHMENT_ACTION;
        }
      } else if (conditionsKey && payload && payload.hasOwnProperty(conditionsKey)) {
        // Get the template structure from the schema, not from the first data row
        const templateFilters = template?.filters?.[0] || {};
        const rowTemplate: Record<string, any> = {};

        // Build rowTemplate from field definitions (only default values, not user data)
        Object.keys(templateFilters).forEach((fieldKey) => {
          const fieldDef = templateFilters[fieldKey];
          // Only include fields that have a 'value' property in the template (default values)
          if (fieldDef && typeof fieldDef === 'object' && 'value' in fieldDef) {
            // Use the default value from template, but don't override with actual data
            if (typeof fieldDef.value === 'string' && fieldDef.value.match(/^{{.*}}$/)) {
              // Skip template placeholder values like {{column_name}}
              rowTemplate[fieldKey] = '';
            } else {
              rowTemplate[fieldKey] = fieldDef.value;
            }
          }
        });

        // Determine the condition_type based on node type
        let defaultConditionType: string | undefined;
        if (nodeId === 'add_column') {
          defaultConditionType = 'new_column';
        } else if (nodeId === 'drop_column') {
          defaultConditionType = 'drop_column';
        } else if (nodeId === 'rename_column') {
          defaultConditionType = 'rename_column';
        } else if (nodeId === 'sort_data') {
          defaultConditionType = 'sort';
        }

        payload[conditionsKey] = multiRowData.map((formRow) => {
          const row = {
            ...rowTemplate,
            ...formRow,
          };

          // Add condition_type if it's missing and we have a default for this node type
          if (defaultConditionType && !row.condition_type) {
            row.condition_type = defaultConditionType;
          }

          return row;
        });
      }
    } else {
      const dataToUse = data || formValues;
      if (payload) {
        // First, ensure all fields from template are in payload
        if (template) {
          Object.keys(template).forEach((templateKey) => {
            const fieldValue = dataToUse?.[templateKey];
            if (fieldValue !== undefined) {
              // Check if the field value is a template placeholder
              if (typeof fieldValue === 'string' && fieldValue.match(/^{{.*}}$/)) {
                payload[templateKey] = '';
              } else if (Array.isArray(fieldValue) && fieldValue.length === 0) {
                const origVal = template[templateKey]?.value;
                if (typeof origVal === 'string') {
                  payload[templateKey] = '';
                } else {
                  payload[templateKey] = fieldValue;
                }
              } else {
                payload[templateKey] = fieldValue;
              }
            }
          });
        }

        // Then, ensure any existing payload keys that might not be in template are also updated
        Object.keys(payload).forEach((payloadKey) => {
          const fieldValue = dataToUse?.[payloadKey];

          if (fieldValue !== undefined) {
            // Check if the field value is a template placeholder
            if (typeof fieldValue === 'string' && fieldValue.match(/^{{.*}}$/)) {
              payload[payloadKey] = '';
            } else if (Array.isArray(fieldValue) && fieldValue.length === 0) {
              const origVal = template?.[payloadKey]?.value;
              if (typeof origVal === 'string') {
                payload[payloadKey] = '';
              } else {
                payload[payloadKey] = fieldValue;
              }
            } else {
              payload[payloadKey] = fieldValue;
            }
          } else {
            // If field is not in form data, check if existing value is a template placeholder
            const existingValue = payload[payloadKey];
            if (typeof existingValue === 'string' && existingValue.match(/^{{.*}}$/)) {
              // Replace template placeholders with empty string
              payload[payloadKey] = '';
            } else {
              payload[payloadKey] = existingValue;
            }
          }
        });
      }
      if (template) {
        Object.keys(template).forEach((templateKey) => {
          if (dataToUse?.[templateKey] !== undefined) {
            template[templateKey].value = dataToUse[templateKey];
          }
        });
      }
      if (updatedNodeData?.data?.node_id === "master_data" && payload) {
        const metadataFields = [
          "name",
          "file_name",
          "file_type",
          "encrypted_file_key",
          "sheet_name",
          "unique_id",
          "size"
        ];
        metadataFields.forEach((f) => {
          if (dataToUse?.[f] !== undefined) {
            payload[f] = dataToUse[f];
          }
        });
      }
      if (isDeduplicationNodeId(updatedNodeData?.data?.node_id) && payload) {
        const d = dataToUse as Record<string, unknown> | undefined;
        const col = d?.survivor_column;
        const strat = d?.survivor_strategy;
        (payload as Record<string, unknown>).survivor_rules = {
          column: col === undefined || col === null ? "" : col,
          strategy: strat === undefined || strat === null ? "" : strat,
        };
        const includeDup = d?.include_duplicate_groups;
        (payload as Record<string, unknown>).include_duplicate_groups =
          coerceTemplateBoolean(includeDup);
      }
    }
    if (updatedNodeData?.data?.node_id === "api_connector" && payload) {
      const p = payload as Record<string, unknown>;
      sanitizeApiConnectorPayloadForWire(p);
      serializeApiConnectorKeyValueMapsForApi(p);
    }
    const layer = updatedNodeData?.data ?? {};
    const fromName =
      layer.display_name || layer.name
        ? String(layer.display_name ?? layer.name).trim()
        : '';
    const fromType =
      layer.type && layer.node_id ? `${layer.type} (${layer.node_id})` : '';
    const primaryDesc = layer.description ?? nodeData?.data?.description;
    const description =
      primaryDesc != null && String(primaryDesc).trim() !== ''
        ? String(primaryDesc).trim()
        : fromName || fromType || 'Workflow node';

    const showNode =
      layer.show_node ??
      nodeData?.data?.show_node ??
      true;

    return {
      ...template?.save_node?.request,
      ...layer,
      description,
      show_node: showNode,
      is_multiple_form: layer.is_multiple_form || false,
      // Get flow_id from currentWorkflow (source of truth), fallback to URL param
      flow_id: useFlowStore.getState().currentWorkflow?.flow_id || id,
      current_node_id: liveSelected?.id ?? selectedNode?.id,
    };
  };

  const dataPreviewConfig = nodeData?.data?.node?.data_preview as
    | {
        fetch?: { module?: string; klass?: string; params?: Record<string, unknown> };
        preview_to_main_field_map?: {
          target_form_key?: string;
          suggestions_leaf_key?: string;
          suggestion_path_property?: string;
        };
      }
    | undefined;

  const dataPreviewFetch = dataPreviewConfig?.fetch;
  const showDataPreviewButton = Boolean(
    dataPreviewFetch?.module &&
      dataPreviewFetch?.klass &&
      dataPreviewFetch?.params &&
      typeof dataPreviewFetch.params === "object"
  );

  const isMultiRowDataEnrichment =
    nodeData?.data?.node_id === "data_enrichment" &&
    nodeData?.data?.is_multiple_form === true;
  const showFormLevelDataPreview =
    showDataPreviewButton && !isMultiRowDataEnrichment;

  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [dataPreviewRowId, setDataPreviewRowId] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewResult, setPreviewResult] = useState<Record<string, unknown> | null>(null);
  const [previewSelectedPath, setPreviewSelectedPath] = useState<string | null>(null);

  const previewScalarSuggestions = useMemo(() => {
    if (!previewResult) return [] as { path?: string; value_preview?: string }[];
    const map = dataPreviewConfig?.preview_to_main_field_map;
    const pathProp = map?.suggestion_path_property || "path";
    const leafKey = map?.suggestions_leaf_key?.trim();

    const r = previewResult as Record<string, unknown>;

    const readPath = (root: unknown, dotted: string): unknown => {
      const parts = dotted.split(".").filter(Boolean);
      let cur: unknown = root;
      for (const p of parts) {
        if (cur == null || typeof cur !== "object") {
          return undefined;
        }
        cur = (cur as Record<string, unknown>)[p];
      }
      return cur;
    };

    /** Prefer API `suggested_paths_scalars` (leaf scalars); support root, nested `data`, or `suggestions_leaf_key` path. */
    const pickSuggestionList = (): unknown[] => {
      const rootScalars = r.suggested_paths_scalars;
      if (Array.isArray(rootScalars) && rootScalars.length > 0) {
        return rootScalars;
      }

      const dataLayer = r.data;
      if (dataLayer && typeof dataLayer === "object" && !Array.isArray(dataLayer)) {
        const nestedScalars = (dataLayer as Record<string, unknown>).suggested_paths_scalars;
        if (Array.isArray(nestedScalars) && nestedScalars.length > 0) {
          return nestedScalars;
        }
      }

      if (leafKey) {
        const viaLeaf = readPath(previewResult, leafKey);
        if (Array.isArray(viaLeaf) && viaLeaf.length > 0) {
          return viaLeaf;
        }
        const legacyLeaf = readPath(
          previewResult,
          leafKey.replace(/^data\./, "")
        );
        if (Array.isArray(legacyLeaf) && legacyLeaf.length > 0) {
          return legacyLeaf;
        }
      }

      const rootPaths = r.suggested_paths;
      if (Array.isArray(rootPaths) && rootPaths.length > 0) {
        return rootPaths;
      }

      const nestedPaths =
        dataLayer && typeof dataLayer === "object" && !Array.isArray(dataLayer)
          ? (dataLayer as Record<string, unknown>).suggested_paths
          : undefined;
      if (Array.isArray(nestedPaths) && nestedPaths.length > 0) {
        return nestedPaths;
      }

      return [];
    };

    const list = pickSuggestionList();
    return list.map((row: unknown) => {
      if (!row || typeof row !== "object") return { path: "", value_preview: "" };
      const rowObj = row as Record<string, unknown>;
      const p = rowObj[pathProp] ?? rowObj.path;
      return {
        path: p == null ? "" : String(p),
        value_preview:
          rowObj.value_preview == null ? "" : String(rowObj.value_preview),
      };
    });
  }, [previewResult, dataPreviewConfig]);

  const handleDataPreviewClick = useCallback(
    async (previewSourceRowId?: number | null) => {
      if (!dataPreviewFetch?.module || !dataPreviewFetch?.klass || !dataPreviewFetch.params) {
        toast.error("Data preview is not configured for this node.");
        return;
      }
      if (
        isMultiRowDataEnrichment &&
        (previewSourceRowId === undefined ||
          previewSourceRowId === null ||
          !multiRowData[previewSourceRowId as number])
      ) {
        toast.error("Use the Data preview button on a configuration block.");
        return;
      }

      setDataPreviewRowId(
        isMultiRowDataEnrichment && previewSourceRowId != null
          ? previewSourceRowId
          : null
      );
      setPreviewDialogOpen(true);
      setPreviewLoading(true);
      setPreviewError(null);
      setPreviewResult(null);
      setPreviewSelectedPath(null);

      try {
        const payloadToSend = buildPayload();
        const previewNodeId = nodeData?.data?.node_id;
        const previewPayload = payloadToSend.node?.payload as
          | Record<string, unknown>
          | undefined;
        // New data_enrichment schema: preview uses {{dataframe}} but payload may omit `dataframe`;
        // still hydrate from upstream for template resolution (same as nodes that declare dataframe).
        const shouldAttachUpstreamDataframe =
          Boolean(previewPayload?.dataframe) ||
          previewNodeId === "data_enrichment";
        if (shouldAttachUpstreamDataframe && previewPayload && previewNodeId) {
          if (
            previewNodeId === "data_enrichment" &&
            !Object.prototype.hasOwnProperty.call(previewPayload, "dataframe")
          ) {
            previewPayload.dataframe = true;
          }
          const mode =
            (formValues as { mode?: string }).mode ??
            (previewPayload.mode as string | undefined);
          attachUpstreamDataframeForPayload(
            payloadToSend,
            previewNodeId,
            sourceNodes,
            mode
          );
        }

        const basePayload =
          (payloadToSend.node?.payload as Record<string, unknown>) || {};
        let merged: Record<string, unknown>;

        if (
          isMultiRowDataEnrichment &&
          previewSourceRowId != null &&
          multiRowData[previewSourceRowId]
        ) {
          const pathKey = getDataEnrichmentPathFormKey(nodeData);
          const builtRules = readDataEnrichmentRulesList(
            payloadToSend.node?.payload as Record<string, unknown> | undefined
          );
          const row: Record<string, unknown> =
            builtRules && builtRules[previewSourceRowId]
              ? { ...builtRules[previewSourceRowId] }
              : {
                  ...(multiRowData[previewSourceRowId] as Record<string, unknown>),
                };
          normalizeDataEnrichmentPathFieldOnRow(row, pathKey);
          const existingData = getPayloadDataObject(basePayload);
          merged = {
            ...basePayload,
            ...row,
            data: {
              is_pandas: existingData.is_pandas === true,
              is_polars: existingData.is_polars === true,
              response_type:
                typeof existingData.response_type === "string"
                  ? existingData.response_type
                  : "json",
              rules: [row],
            },
          };
        } else {
          merged = {
            ...basePayload,
            ...(formValues as unknown as Record<string, unknown>),
          };
        }

        if (nodeData?.data?.node_id === "data_enrichment") {
          normalizeDataEnrichmentPathFieldOnRow(
            merged as Record<string, unknown>,
            getDataEnrichmentPathFormKey(nodeData)
          );
        }

        const resolved = resolveTemplateParamObject(
          dataPreviewFetch.params as Record<string, unknown>,
          merged
        ) as Record<string, unknown>;
        // API `params` is often `{ payload: { ...placeholders } }`. POST body must be `{ payload: <inner> }`
        // once — not `{ payload: { payload: inner, stmtDate... } }`.
        const innerPayload =
          resolved.payload != null &&
          typeof resolved.payload === "object" &&
          !Array.isArray(resolved.payload)
            ? (cloneDeep(resolved.payload) as Record<string, unknown>)
            : ({ ...resolved } as Record<string, unknown>);

        const today = new Date().toISOString().split("T")[0];
        innerPayload.stmtDate = today;
        innerPayload.flow_id = useFlowStore.getState().currentWorkflow?.flow_id || id;
        innerPayload.current_node_id = useFlowStore.getState().getSelectedNode()?.id;

        const compressedPayload = compressPayloadData(
          JSON.parse(JSON.stringify(innerPayload))
        );

        const url = `/${dataPreviewFetch.module}/${resolveDatabaseActionsKlass(dataPreviewFetch.klass)}`;
        const res = await api.post(url, { payload: compressedPayload });
        const body = res.data as {
          status?: boolean;
          message?: string;
          data?: Record<string, unknown>;
        };

        if (!body?.status) {
          throw new Error(body?.message || "Preview failed");
        }
        setPreviewResult((body.data as Record<string, unknown>) ?? null);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Preview failed";
        setPreviewError(msg);
        toast.error(msg);
      } finally {
        setPreviewLoading(false);
      }
    },
    [
      dataPreviewFetch,
      formValues,
      id,
      isMultiRowDataEnrichment,
      multiRowData,
      nodeData,
      nodeData?.data?.node_id,
      nodeData?.data?.is_multiple_form,
      sourceNodes,
    ]
  );

  const applyPreviewPathToForm = () => {
    if (!previewSelectedPath) return;
    const targetKey = getDataEnrichmentPathFormKey(nodeData);
    if (
      nodeData?.data?.node_id === "data_enrichment" &&
      nodeData?.data?.is_multiple_form === true &&
      dataPreviewRowId != null
    ) {
      const next = multiRowData.map((row, i) =>
        i === dataPreviewRowId ? { ...row, [targetKey]: previewSelectedPath } : row
      );
      handleMultiRowChange(next);
      toast.success(
        `Path set on configuration ${dataPreviewRowId + 1} (${targetKey.replace(/_/g, " ")}). Click Save to persist.`
      );
    } else {
      handleChange(targetKey, previewSelectedPath);
      toast.success(`Path set on "${targetKey.replace(/_/g, " ")}". Click Save to persist.`);
    }
    setPreviewDialogOpen(false);
    setDataPreviewRowId(null);
  };

  const saveNodeDetails = async (data?: FormSubmissionData) => {
    if(disabled) {
      return;
    }
    if (isFilterDataNode) {
      // filter_data: multi-row state is merged in buildPayload from multiRowData
    }

    // Check if save is explicitly disabled (if save_node exists and enabled is false)
    const isSaveExplicitlyDisabled = template?.save_node && template.save_node.enabled === false;

    if (isSaveExplicitlyDisabled) {
      toast.warning("Save action is disabled for this node type.");
      return;
    }

    if (!saveApiEndpoint) {
      toast.warning("Missing API endpoint for saving.");
      return;
    }

    try {
      const payloadToSend = buildPayload(data, "custom_column");
      if (payloadToSend.node.payload.dataframe) {
        const mode =
          (data?.mode as string | undefined) ??
          (payloadToSend.node.payload.mode as string | undefined);
        attachUpstreamDataframeForPayload(
          payloadToSend,
          nodeData?.data?.node_id,
          sourceNodes,
          mode
        );
      }

      const response = await saveNodeDetailsApi(saveApiEndpoint, payloadToSend);

      // Only call create-file API for Files group nodes when type is "upload"
      if (dataGroup === "Files" && data && data.type === "upload") {
        const fileType = nodeData?.data?.node_id;
        const fileName = data.file_name || '';
        const fileNameWithoutExt = fileName.split('.')[0];

        const createFilePayload: any = {
            name: fileNameWithoutExt,
            type: fileType,
            node_id: response.id,
            show_node: true,
            is_dataset: true,
            display_name: nodeData?.data?.display_name,
            modules: nodeData?.data?.modules,
            klass_name: nodeData?.data?.klass_name,
            group: "Files",
            unique_id: data.unique_id,
            file_name: fileName,
            encrypted_file_key: data.encrypted_file_key,
            file_category: "source_data",
            file_type: fileType,
          };

          if (fileType === "excel" && data.sheet_name) {
            createFilePayload.sheet_name = data.sheet_name;
          }

        await createFileDatasetApi(createFilePayload);
      }

      toast.success("Node configuration saved successfully");

      // Ensure saved_node flag is set and use the built payload with actual values
      // The response might still contain template placeholders, so we use the payload we built
      const updatedData = {
        ...response,
        // Preserve original icon from selectedNode.data if response doesn't have it
        icon: response.icon || selectedNode?.data?.icon,
        node: {
          ...response.node,
          payload: payloadToSend.node.payload, // Use the payload with actual values
          template: payloadToSend.node.template, // Use the template with updated values
        },
        saved_node: true,
      };

      useFlowStore.getState().updateNodeData(selectedNode?.id, updatedData);
    } catch (error) {
      console.error("Save failed:", error);
      toast.error("Failed to save node configuration");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveNodeDetails();
  };

  if (dataGroup === "Databases" && databaseFormSchema) {
    const summaryData =
      liveFormData ?? selectedNode?.data?.node?.payload ?? ({} as FormSubmissionData);

    return (
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
          <div className="lg:col-span-3">
            <DynamicForm
              key={editingData ? "edit-mode" : "new-mode"}
              schema={databaseFormSchema}
              onSubmit={handleFormSubmit}
              initialData={editingData}
              isEditing={!!editingData}
              isDataSetNode={isDataSetNode}
              mode={disabled ? "view" : "edit"}
              onValuesChange={setLiveFormData}
            />
          </div>
          {selectedNode?.data?.saved_node && (
            <div className="lg:col-span-2">
              <FormDataDisplay
                data={summaryData}
                fields={databaseFormSchema?.fields}
                title="Node Configuration"
                onEdit={handleEdit}
                isDataSetNode={isDataSetNode}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  if (dataGroup === "Files") {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
          <div className="lg:col-span-3">
            <FileNodeForm
              key={editingData ? "edit-mode" : "new-mode"}
              schema={transformRawSchema(
                fileGroupTemplate ?? template,
                "Node Configuration",
                "Node Configuration"
              )}
              onSubmit={handleFormSubmit}
              initialData={editingData}
              isEditing={!!editingData}
              mode={disabled ? "view" : "edit"}
            />
          </div>
          {selectedNode?.data?.saved_node && (
            <div className="lg:col-span-2">
              <FormDataDisplay
                data={selectedNode?.data?.node?.payload}
                title="Node Configuration"
                onEdit={handleEdit}
                isDataSetNode={isDataSetNode}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (  
    <>
      <form
        onSubmit={handleSubmit}
        className={useConnectorFormLayout ? "space-y-3 pt-0" : "space-y-2 pt-0"}
      >
        {isMultiRowFormNode && template != null ? ( 
          <MultiRowDynamicForm
            template={template}
            data={multiRowData}
            systemFilters={systemfilters}
            onFormChange={handleMultiRowChange}
            onClickSave={(filterType, data) =>
              handleSaveConditions(filterType, data)
            }
            perRowDataPreview={
              isMultiRowDataEnrichment && showDataPreviewButton
                ? {
                    enabled: true,
                    disabled,
                    onPreviewRow: (rowId) => void handleDataPreviewClick(rowId),
                  }
                : undefined
            }
          />
        ) : (
          dataGroup !== "Databases" &&
          dataGroup !== "Files" &&
          template != null &&
          typeof template === "object" && (
            useConnectorFormLayout ? (
              <div className="mx-auto w-full max-w-5xl px-2 sm:px-0">
                <div className="grid auto-rows-min grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 sm:items-start sm:gap-y-3">
                  {apiConnectorFieldRows.map((row) => {
                    if (row.kind === "paramsHeadersPair") {
                      return (
                        <div
                          key="params-headers-pair"
                          className="min-w-0 self-start sm:col-span-2"
                        >
                          <div className="grid grid-cols-1 gap-y-3 sm:grid-cols-2 sm:items-start sm:gap-x-6">
                            <div className="min-w-0 self-start">
                              <DynamicFieldRenderer
                                field={row.params}
                                value={formValues[row.params.key]}
                                onChange={handleChange}
                                allFormValues={formValues}
                                compact
                              />
                            </div>
                            <div className="min-w-0 self-start">
                              <DynamicFieldRenderer
                                field={row.headers}
                                value={formValues[row.headers.key]}
                                onChange={handleChange}
                                allFormValues={formValues}
                                compact
                              />
                            </div>
                          </div>
                        </div>
                      );
                    }
                    const field = row.field;
                    const fullWidthConnectorField = field.type === "upload";
                    return (
                      <div
                        key={field.key}
                        className={
                          fullWidthConnectorField
                            ? "min-w-0 self-start sm:col-span-2"
                            : "min-w-0 self-start"
                        }
                      >
                        <DynamicFieldRenderer
                          field={field}
                          value={formValues[field.key]}
                          onChange={handleChange}
                          allFormValues={formValues}
                          compact
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="grid auto-rows-min grid-cols-1 items-start gap-4 md:grid-cols-2 lg:grid-cols-3">
                {(Object.values(template) as FieldTemplate[])
                  .filter(
                    (f) =>
                      f &&
                      typeof f === "object" &&
                      typeof f.key === "string" &&
                      typeof f.type === "string"
                  )
                  .filter((f) =>
                    fieldPassesDependencyVisibility(
                      nodeData?.data?.node_id,
                      f,
                      formValues as FormSubmissionData
                    )
                  )
                  .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
                  .map((field) => (
                    <div
                      key={field.key}
                      className={
                        field.type === "key-value" || field.type === "checkbox"
                          ? "md:col-span-2 lg:col-span-3"
                          : undefined
                      }
                    >
                      <DynamicFieldRenderer
                        field={field}
                        value={formValues[field.key]}
                        onChange={handleChange}
                        allFormValues={formValues}
                      />
                    </div>
                  ))}
              </div>
            )
          )
        )}
        <div
          className={cn(
            "flex flex-wrap items-center gap-2 pt-2",
            useConnectorFormLayout
              ? "mx-auto w-full max-w-5xl justify-between px-1 sm:px-0"
              : "justify-between"
          )}
        >
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {showFormLevelDataPreview && (
              <Button
                type="button"
                variant="secondary"
                disabled={disabled}
                className="gap-1.5 border-primary/25 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent shadow-sm hover:from-primary/15"
                onClick={() => void handleDataPreviewClick()}
              >
                <Sparkles className="h-4 w-4 shrink-0 text-primary" />
                Data preview
              </Button>
            )}
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2 sm:gap-3">
            <Button variant="outline" type="button" onClick={onClose} className="!h-8">
              Cancel
            </Button>
            <Button type="submit" disabled={disabled} className="disabled:cursor-not-allowed !h-8">
              {saveButtonLabel}
            </Button>
          </div>
        </div>
      </form>

      <Dialog
        open={previewDialogOpen}
        onOpenChange={(open) => {
          setPreviewDialogOpen(open);
          if (!open) setDataPreviewRowId(null);
        }}
      >
        <DialogContent className="flex max-h-[min(88vh,820px)] max-w-3xl flex-col gap-0 overflow-hidden border-border/80 bg-background p-0 shadow-2xl sm:max-w-3xl">
          <DialogHeader className="shrink-0 space-y-1 border-b border-border/60 px-5 py-4 text-left">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="min-w-0 space-y-1">
                <DialogTitle className="text-lg font-semibold leading-tight tracking-tight">
                  Pick a JSON path
                </DialogTitle>
                <DialogDescription className="text-sm leading-snug text-muted-foreground">
                  Review the preview row, then choose which scalar field to map into your node.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {previewLoading && (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm font-medium">Calling preview API…</p>
              </div>
            )}

            {!previewLoading && previewError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {previewError}
              </div>
            )}

            {!previewLoading && !previewError && previewResult && (
              <div className="space-y-6">
                {(() => {
                  const pr = previewResult as Record<string, unknown>;
                  const pathKey = getDataEnrichmentPathFormKey(nodeData);
                  const rowIdx = dataPreviewRowId;
                  const fromRow =
                    rowIdx != null && multiRowData[rowIdx]
                      ? (multiRowData[rowIdx] as Record<string, unknown>)
                      : null;
                  const rawSaved =
                    fromRow?.[pathKey] ??
                    (formValues as Record<string, unknown>)[pathKey];
                  const savedJsonPath =
                    rawSaved == null ? "" : String(rawSaved).trim();
                  const previewRow =
                    pr.preview_row &&
                    typeof pr.preview_row === "object" &&
                    !Array.isArray(pr.preview_row)
                      ? (pr.preview_row as Record<string, unknown>)
                      : null;
                  const sourceColumns = Array.isArray(pr.source_columns)
                    ? (pr.source_columns as unknown[]).map(String)
                    : [];
                  const sampleSource =
                    typeof pr.preview_sample_row_source === "string"
                      ? pr.preview_sample_row_source
                      : null;
                  if (
                    savedJsonPath === "" &&
                    sourceColumns.length === 0 &&
                    previewRow == null
                  ) {
                    return null;
                  }
                  return (
                    <section
                      aria-label="Preview context"
                      className="rounded-lg border border-border/70 bg-muted/20 px-4 py-3.5"
                    >
                      <h3 className="mb-3 text-xs font-medium text-foreground">
                        Context
                      </h3>
                      <dl className="grid gap-3 sm:grid-cols-2 sm:gap-x-8 sm:gap-y-3">
                        {savedJsonPath !== "" && (
                          <div className="min-w-0 sm:col-span-2">
                            <dt className="text-[11px] font-medium text-muted-foreground">
                              Saved JSON path
                              <span className="ml-1 font-normal opacity-80">
                                ({pathKey.replace(/_/g, " ")})
                              </span>
                            </dt>
                            <dd className="mt-1">
                              <code className="block w-fit max-w-full break-all rounded-md border border-border/60 bg-background px-2 py-1 font-mono text-xs font-medium text-primary">
                                {savedJsonPath}
                              </code>
                            </dd>
                          </div>
                        )}
                        
                        
                        {previewRow && (
                          <div className="min-w-0 sm:col-span-2">
                          </div>
                        )}
                      </dl>
                    </section>
                  );
                })()}

                <section aria-label="Scalar path options" className="space-y-3">
                  <div className="flex items-end justify-between gap-2 border-b border-border/50 pb-2">
                    <h3 className="text-xs font-medium text-foreground">
                      Suggested scalar paths
                    </h3>
                    {previewScalarSuggestions.length > 0 && (
                      <span className="text-[11px] tabular-nums text-muted-foreground">
                        {previewScalarSuggestions.length} options
                      </span>
                    )}
                  </div>
                  {previewScalarSuggestions.length === 0 ? (
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      No suggested paths returned. Try another connection or HTTP
                      settings.
                    </p>
                  ) : (
                    <ScrollArea className="h-[min(46vh,360px)] pr-2">
                      <ul className="flex flex-col gap-1.5 pb-1">
                        {previewScalarSuggestions.map((row, idx) => {
                          const active = previewSelectedPath === row.path;
                          return (
                            <li key={`scalar-path-${idx}-${row.path || "x"}`}>
                              <button
                                type="button"
                                onClick={() => setPreviewSelectedPath(row.path || null)}
                                className={cn(
                                  "flex w-full flex-col gap-1 rounded-lg border px-3 py-2.5 text-left transition-colors sm:flex-row sm:items-start sm:justify-between sm:gap-4",
                                  "border-border/70 bg-card hover:border-primary/35 hover:bg-accent/30",
                                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                                  active &&
                                    "border-primary bg-primary/[0.06] ring-1 ring-primary/30"
                                )}
                              >
                                <div className="flex min-w-0 flex-1 items-start gap-2">
                                  <code className="break-all font-mono text-xs font-semibold leading-snug text-primary">
                                    {row.path || "—"}
                                  </code>
                                  {active && (
                                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary sm:hidden" />
                                  )}
                                </div>
                                <div className="flex min-w-0 flex-1 items-start justify-between gap-2 sm:justify-end">
                                  <p className="line-clamp-3 min-w-0 text-left text-xs leading-snug text-muted-foreground sm:max-w-[55%] sm:text-right">
                                    {row.value_preview || "—"}
                                  </p>
                                  {active && (
                                    <CheckCircle2 className="mt-0.5 hidden h-3.5 w-3.5 shrink-0 text-primary sm:block" />
                                  )}
                                </div>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </ScrollArea>
                  )}
                </section>
              </div>
            )}
          </div>

          <DialogFooter className="shrink-0 gap-2 border-t border-border/60 bg-muted/10 px-5 py-3 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-w-[5rem]"
              onClick={() => {
                setPreviewDialogOpen(false);
                setDataPreviewRowId(null);
              }}
            >
              Close
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!previewSelectedPath || disabled}
              onClick={applyPreviewPathToForm}
              className="min-w-[10rem] gap-1.5"
            >
              <CheckCircle2 className="h-4 w-4" />
              Use selected path
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default NodeForm;